import mongoose from "mongoose";

const quotationSchema = new mongoose.Schema(
  {
    rfqRef: { type: mongoose.Schema.Types.ObjectId, ref: "Rfq", required: true },
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: "Vendor", required: true },
    item: { type: mongoose.Schema.Types.ObjectId, ref: "Item", required: true },
    quantity: { type: Number, required: true, min: 0 },

    rate: { type: Number, required: true, min: 0 },
    gst: { type: Number, min: 0, default: 0 }, // amount, not percent — see landedCostService
    freight: { type: Number, min: 0, default: 0 },
    discount: { type: Number, min: 0, default: 0 },
    otherCharges: { type: Number, min: 0, default: 0 },

    // Computed by services/landedCostService.js as
    // rate + gst + freight + otherCharges - discount (RA v2.0 Sec. 8, point 5).
    finalLandedCost: { type: Number, min: 0, default: 0 },

    paymentTerms: { type: String, trim: true },
    deliveryTime: { type: String, trim: true },
    qualitySpecification: { type: String, trim: true },

    isLowestRate: { type: Boolean, default: false }, // recomputed whenever a sibling quotation changes
    selected: { type: Boolean, default: false },
    reasonForSelection: { type: String, trim: true },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, // Purchase Manager
  },
  { timestamps: true }
);

// A vendor should only quote once per RFQ for a given item.
quotationSchema.index({ rfqRef: 1, vendor: 1, item: 1 }, { unique: true });

export default mongoose.model("Quotation", quotationSchema);
