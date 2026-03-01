import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

MONGODB_URI = os.getenv("MONGODB_URI")
client: AsyncIOMotorClient = None
db = None

async def connect_to_mongo():
    global client, db
    if not MONGODB_URI:
        print("WARNING: MONGODB_URI is not set in environment variables.")
        return
    
    try:
        client = AsyncIOMotorClient(MONGODB_URI)
        db = client.travel_planner # Creates a 'travel_planner' database
        print("Connected to MongoDB Atlas successfully!")
    except Exception as e:
        print(f"Error connecting to MongoDB: {e}")

async def close_mongo_connection():
    global client
    if client:
        client.close()
        print("MongoDB connection closed.")

def get_db():
    return db
