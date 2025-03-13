require('dotenv').config({ path: './config/.env' });
console.log("MONGO_URI:", process.env.MONGO_URI);

const mongoose = require('mongoose');
const XLSX = require('xlsx');
const crypto = require('crypto'); // for a random hash 

// Import both models
const ParkingLot = require('./ParkingLot.js');
const ParkingSpot = require('./ParkingSpot.js');

const MONGO_URI = process.env.MONGO_URI;

// Helper function: parse a column as integer or return 0 if invalid
function parseOrZero(value) {
  const num = parseInt(value, 10);
  return isNaN(num) ? 0 : num;
}

async function main() {
  try {
    // 1) Connect to Mongo
    await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('Connected to MongoDB');

    // 2) Excel file
    const workbook = XLSX.readFile('./src/ParkingSpaceInventory.xlsx');
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    // Convert to array of row objects
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    // Slice to only process the first 87 rows
    const truncatedRows = rows.slice(0, 87);


    // 3) Process each row (up to row 87)
    for (const row of truncatedRows) {

      const rawLocation = row['Location'] || 'NA';
      const totalSpaces = parseOrZero(row['Total # Spaces']);

      const facultyStaff = parseOrZero(row['Faculty/Staff']);
      const commuterPremium = parseOrZero(row['Commuter Premium']);
      const metered = parseOrZero(row['Metered']);
      const commuter = parseOrZero(row['Commuter']);
      const resident = parseOrZero(row['Resident']);
      const ada = parseOrZero(row['ADA']);
      const reservedMisc = parseOrZero(row['Reserved/Misc.']);
      const stateVehiclesOnly = parseOrZero(row['State Vehicles Only']);
      const specialServiceVehiclesOnly = parseOrZero(row['Special Service Vehicles Only']);
      const stateAndSpecialServiceVehicles = parseOrZero(row['State and Special Service Vehicles']);
      const evCharging = parseOrZero(row['EV Charging']);

      // Generate a random lotId
      const randomHash = crypto.randomBytes(4).toString('hex');
      const lotId = `${Date.now()}-${randomHash}`;

      // 3A) Create a ParkingLot document (w/ empty spots array for now)
      const newLot = new ParkingLot({
        lotId,
        lotName: rawLocation,
        location: 'Main Campus West',
        capacity: totalSpaces,
        baseRate: 0,
        facultyStaff,
        commuterPremium,
        metered,
        commuter,
        resident,
        ada,
        reservedMisc,
        stateVehiclesOnly,
        specialServiceVehiclesOnly,
        stateAndSpecialServiceVehicles,
        evCharging,
        spots: [] 
      });

      // Save it so we can reference its _id
      const lotDoc = await newLot.save();

      // 3B) Generate ParkingSpot docs referencing this lot
      // we try to parse a prefix from something like "Lot 3A Stadium..."
      const prefixMatch = rawLocation.match(/\b[A-Za-z0-9]+\b/g);
      let prefix = 'LOT'; // fallback
      if (prefixMatch && prefixMatch.length > 1) {
        prefix = prefixMatch[1]; // e.g. "3A"
      }

      const spotDocs = [];
      for (let i = 1; i <= totalSpaces; i++) {
        spotDocs.push({
          spotId: `${prefix}-${String(i).padStart(3, '0')}`,
          parkingLotId: lotDoc._id, // Reference the lot we just created
          spotType: 'regular',
          isOccupied: false,
          isReserved: false,
          level: 1,
        });
      }

      // 3C) Insert all the spots at once
      const insertedSpots = await ParkingSpot.insertMany(spotDocs);

      // 3D) Collect the inserted IDs and attach them to the lot
      const spotIds = insertedSpots.map(s => s._id);

      lotDoc.spots = spotIds;
      await lotDoc.save(); // Update the lot doc with the references

      console.log(
        `Saved lotName="${rawLocation}" with lotId="${lotId}", ` +
        `capacity=${totalSpaces}, and ${spotIds.length} separate spot docs.`
      );
    }

    console.log('All lots imported successfully (up to row 87).');

  } catch (error) {
    console.error('Error seeding data:', error);
  } finally {
    // 4) Close DB connection
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

main();

