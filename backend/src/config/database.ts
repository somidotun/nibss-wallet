import mongoose from "mongoose";

const connectDB = async (): Promise<void> => {
  try {
    const mongoURI = process.env.MONGO_URI;

    if (!mongoURI) {
      throw new Error("MONGO_URI is not defined in the environment variables");
    }

    const conn = await mongoose.connect(mongoURI);
    // eslint-disable-next-line no-console
    console.info(`MongoDB connected successfully ${conn.connection.host}`);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Error connecting to MongoDB:", error);
    process.exit(1);
  }
};

export default connectDB;
