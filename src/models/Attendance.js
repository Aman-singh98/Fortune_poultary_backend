import mongoose from "mongoose";

const attendanceSchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", required: true },
    site: { type: mongoose.Schema.Types.ObjectId, ref: "Site", required: true },
    date: { type: Date, required: true },

    status: {
      type: String,
      enum: [
        "PRESENT",       // P
        "ABSENT",        // A
        "HALF_DAY",      // Halfday
        "OVERTIME",      // logged alongside another status, hours tracked separately below
        "PRESENT_X2",    // P x 2
        "PRESENT_HALF",  // P/2
        "LEAVE",
        "SUNDAY",
        "HOLIDAY",
      ],
      required: true,
    },

    overtimeHours: { type: Number, default: 0, min: 0 },
    eggsSold: { type: Number, default: 0, min: 0 },
    birdsSold: { type: Number, default: 0, min: 0 },
    remarks: { type: String, trim: true, default: "" },

    markedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    markedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// One attendance record per employee per calendar day
attendanceSchema.index({ employee: 1, date: 1 }, { unique: true });

export default mongoose.model("Attendance", attendanceSchema);
