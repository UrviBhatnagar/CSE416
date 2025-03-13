const mongoose = require('mongoose');
const { Schema } = mongoose;

const ParkingSpotSchema = new Schema({
  spotId: {
    type: String
  },
  parkingLotId: {
    type: Schema.Types.ObjectId,
    ref: 'ParkingLot'
  },
  spotType: {
    type: String,
    default: 'regular'
  },
  isOccupied: {
    type: Boolean,
    default: false
  },
  isReserved: {
    type: Boolean,
    default: false
  },
  level: {
    type: Number,
    default: 1
  }
});

module.exports = mongoose.model('ParkingSpot', ParkingSpotSchema);
