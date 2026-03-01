from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Dict, Any, List
from datetime import datetime
from app.graph.travel_graph import build_travel_graph
from app.models.database import get_db

router = APIRouter()
travel_graph = build_travel_graph()

class TripRequest(BaseModel):
    destination: str
    days: int
    budget: str
    travel_style: str
    trip_type: str
    starting_location: str = ""
    travel_mode: str = ""
    specific_locations: str = ""
    is_ev: bool = False
    ev_brand: str = ""
    ev_model: str = ""
    ev_battery: str = ""
    ev_range: int = 0
    wants_hotel: bool = False
    check_in_date: str = ""
    check_out_date: str = ""
    rooms: int = 1
    guests: int = 2
    price_per_night: str = ""

@router.post("/plan-trip")
async def plan_trip(request: TripRequest):
    try:
        initial_state = {
            "destination": request.destination,
            "days": request.days,
            "budget": request.budget,
            "travel_style": request.travel_style,
            "trip_type": request.trip_type,
            "starting_location": request.starting_location,
            "travel_mode": request.travel_mode,
            "specific_locations": request.specific_locations,
            "is_ev": request.is_ev,
            "ev_brand": request.ev_brand,
            "ev_model": request.ev_model,
            "ev_battery": request.ev_battery,
            "ev_range": request.ev_range,
            "wants_hotel": request.wants_hotel,
            "check_in_date": request.check_in_date,
            "check_out_date": request.check_out_date,
            "rooms": request.rooms,
            "guests": request.guests,
            "price_per_night": request.price_per_night,
            "destinations": [],
            "top_attractions": {},
            "recommended_hotels": {},
            "reasoning": "",
            "day_wise_plan": {},
            "route_details": {},
            "estimated_budget": {},
            "budget_tips": []
        }
        
        # Run graph
        result = travel_graph.invoke(initial_state)
        
        return {
            "destinations": result.get("destinations", []),
            "top_attractions": result.get("top_attractions", {}),
            "recommended_hotels": result.get("recommended_hotels", {}),
            "reasoning": result.get("reasoning", ""),
            "route_details": result.get("route_details", {}),
            "day_wise_plan": result.get("day_wise_plan", {}),
            "ev_charging_strategy": result.get("ev_charging_strategy", {}),
            "estimated_budget": result.get("estimated_budget", {}),
            "budget_tips": result.get("budget_tips", []),
            "starting_location": result.get("starting_location", request.starting_location)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class SaveTripRequest(BaseModel):
    user_id: str
    destination: str
    trip_data: Dict[str, Any]

@router.post("/trips/save")
async def save_trip(request: SaveTripRequest):
    db = get_db()
    if db is None:
        raise HTTPException(status_code=500, detail="Database connection failed.")
    
    try:
        trip_document = {
            "user_id": request.user_id,
            "destination": request.destination,
            "trip_data": request.trip_data,
            "created_at": datetime.utcnow()
        }
        
        result = await db.saved_trips.insert_one(trip_document)
        return {"status": "success", "message": "Trip saved securely to MongoDB Atlas.", "trip_id": str(result.inserted_id)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save trip: {str(e)}")

@router.get("/trips/{user_id}")
async def get_user_trips(user_id: str):
    db = get_db()
    if db is None:
        raise HTTPException(status_code=500, detail="Database connection failed.")
        
    try:
        # Fetch all trips for user, sorted by newest first
        cursor = db.saved_trips.find({"user_id": user_id}).sort("created_at", -1)
        trips = await cursor.to_list(length=100)
        
        return {
            "trips": [
                {
                    "id": str(trip["_id"]),
                    "destination": trip["destination"],
                    "created_at": trip["created_at"].isoformat(),
                    "trip_data": trip.get("trip_data", {})
                }
                for trip in trips
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
