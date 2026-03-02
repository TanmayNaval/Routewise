from pydantic import BaseModel, Field
from typing import List, Dict, Any
from langchain_core.prompts import ChatPromptTemplate
from app.models.state import TravelState
from app.agents.destination_agent import get_llm

class EstimatedBudget(BaseModel):
    stay: int = Field(description="Estimated cost for stay in INR")
    food: int = Field(description="Estimated cost for food in INR")
    transport: int = Field(description="Estimated cost for transport in INR")
    activities: int = Field(description="Estimated cost for activities in INR")
    total: int = Field(description="Total estimated cost in INR")

class BudgetOutput(BaseModel):
    estimated_budget: EstimatedBudget = Field(description="The breakdown of estimated costs.")
    budget_tips: List[str] = Field(description="List of tips to save money")

def budget_node(state: TravelState) -> dict:
    llm = get_llm()
    structured_llm = llm.with_structured_output(BudgetOutput)
    
    system_prompt = "You are a Budget Planning Agent catering to Indian travelers. Given an itinerary and a budget level, estimate costs strictly in Indian Rupees (INR) and provide money-saving tips tailored for Indians. Respond in structured JSON format. Return raw integers for amounts. Take into account the starting location and travel mode when calculating transport costs."
    user_prompt = "Estimate budget in INR for a {days}-day trip to {destination_list} with a {budget} budget level. The itinerary is: {itinerary}. Starting Location: {starting_location}, Preferred Travel Mode: {travel_mode}. Ensure the currency is INR."
    
    if state.get("wants_hotel"):
        system_prompt += " The user wants a hotel included. Calculate the 'stay' budget realistically based on their requested price range, number of rooms, and number of nights."
        user_prompt += f" RECALL: The user needs a hotel. They requested {state.get('rooms')} rooms for {state.get('guests')} guests. Price per night range: {state.get('price_per_night')} INR. Make sure the 'stay' cost in your estimated_budget reflects {state.get('rooms')} rooms * {state.get('days')} nights * an appropriate price within the {state.get('price_per_night')} range!"
    
    prompt = ChatPromptTemplate.from_messages([
        ("system", system_prompt),
        ("user", user_prompt)
    ])
    
    chain = prompt | structured_llm
    
    try:
        response = chain.invoke({
            "days": state.get("days", 1),
            "destination_list": ", ".join(state.get("destinations", [])),
            "budget": state.get("budget", "medium"),
            "itinerary": state.get("day_wise_plan", {}),
            "starting_location": state.get("starting_location", "Not specified"),
            "travel_mode": state.get("travel_mode", "Not specified")
        })
        
        return {
            "estimated_budget": response.estimated_budget,
            "budget_tips": response.budget_tips
        }
    except Exception as e:
        print(f"Error in BudgetAgent: {e}")
        return {
            "estimated_budget": {
                "stay": 0, "food": 0, "transport": 0, "activities": 0, "total": 0
            },
            "budget_tips": ["Keep track of your expenses manually due to an error."]
        }
