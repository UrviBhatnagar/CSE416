const mongoose = require('mongoose');
const { Schema } = mongoose;

const ParkingLotSchema = new Schema({
  lotId: { type: String, unique: true },
  lotName: { type: String, default: 'NA' },
  location: { type: String, default: 'Main Campus West' },
  capacity: { type: Number, default: 0 },
  // Instead of storing subdocuments, we store references:
  spots: [
    {
      type: Schema.Types.ObjectId,
      ref: 'ParkingSpot'
    }
  ],
  baseRate: { type: Number, default: 0 },

  facultyStaff: { type: Number, default: 0 },
  commuterPremium: { type: Number, default: 0 },
  metered: { type: Number, default: 0 },
  commuter: { type: Number, default: 0 },
  resident: { type: Number, default: 0 },
  ada: { type: Number, default: 0 },
  reservedMisc: { type: Number, default: 0 },
  stateVehiclesOnly: { type: Number, default: 0 },
  specialServiceVehiclesOnly: { type: Number, default: 0 },
  stateAndSpecialServiceVehicles: { type: Number, default: 0 },
  evCharging: { type: Number, default: 0 }
});

module.exports = mongoose.model('ParkingLot', ParkingLotSchema);
