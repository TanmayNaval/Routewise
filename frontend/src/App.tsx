import React, { useState } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import {
  Calendar, Wallet, CheckCircle2,
  AlertCircle, ArrowRight, Loader2, MapPin, Globe2,
  Home, Map, ChevronDown, User, Briefcase, History, Plane, Zap
} from 'lucide-react';
import { SignedIn, SignedOut, SignInButton, UserButton, useUser, useClerk } from '@clerk/clerk-react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-10 m-10 bg-red-50 text-red-900 border border-red-200 rounded-xl max-w-2xl mx-auto shadow-2xl">
          <h2 className="text-2xl font-bold mb-4">Frontend Crashed!</h2>
          <p className="mb-4">We caught the exact error causing the white screen:</p>
          <pre className="bg-red-100 p-4 rounded text-sm overflow-auto whitespace-pre-wrap font-mono">
            {this.state.error?.toString()}
          </pre>
          <p className="mt-4 text-xs font-semibold uppercase text-red-500">Please take a screenshot of this box!</p>
          <button onClick={() => window.location.reload()} className="mt-6 bg-red-600 text-white px-4 py-2 rounded font-bold">Reload Page</button>
        </div>
      );
    }
    return this.props.children;
  }
}

const EV_CARS: Record<string, Record<string, string[]>> = {
  "Tata Motors": {
    "Tiago EV": ["19.2 kWh", "24.0 kWh"],
    "Tigor EV": ["26.0 kWh"],
    "Punch EV": ["25.0 kWh", "35.0 kWh"],
    "Nexon EV": ["30.0 kWh", "40.5 kWh", "45.0 kWh"],
    "Curvv EV": ["45.0 kWh", "55.0 kWh"],
    "Harrier EV": ["65.0 kWh", "75.0 kWh"]
  },
  "Mahindra": {
    "XUV400": ["34.5 kWh", "39.4 kWh"],
    "BE 6e": ["59.0 kWh", "79.0 kWh"],
    "XEV 9e": ["59.0 kWh", "79.0 kWh"]
  },
  "MG Motor": {
    "Comet EV": ["17.3 kWh"],
    "Windsor EV": ["38.0 kWh"],
    "ZS EV": ["50.3 kWh"]
  },
  "Maruti Suzuki": {
    "e-Vitara": ["49.0 kWh", "61.0 kWh"]
  },
  "Hyundai": {
    "Kona Electric": ["39.2 kWh"],
    "Ioniq 5": ["72.6 kWh"],
    "Creta EV": ["~45.0 kWh"]
  },
  "BYD": {
    "Atto 3": ["49.92 kWh", "60.48 kWh"],
    "eMAX 7": ["55.4 kWh", "71.8 kWh"],
    "Seal": ["61.44 kWh", "82.56 kWh"]
  },
  "Kia": {
    "EV6": ["77.4 kWh"],
    "EV9": ["99.8 kWh"]
  },
  "Citroën": {
    "ë-C3": ["29.2 kWh"],
    "ë-C3 Aircross": ["29.2 kWh"]
  },
  "Volvo": {
    "EX30": ["69.0 kWh"],
    "XC40 Recharge / EX40": ["69.0 kWh", "78.0 kWh"],
    "C40 Recharge": ["78.0 kWh"]
  },
  "VinFast": {
    "VF6": ["59.6 kWh"]
  },
  "Tesla": {
    "Model Y": ["60.0 kWh", "75.0 kWh", "81.0 kWh"]
  }
};

interface TripState {
  destinations: string[];
  top_attractions: Record<string, string[]>;
  recommended_hotels?: Record<string, string[]>;

  reasoning: string;
  route_details?: {
    routes: Record<string, {
      distance: string;
      estimated_time: string;
      road_conditions: string;
      route_advice: string;
      recommended_stops: string[];
    }>;
    summary: string;
  };
  day_wise_plan: Record<string, string[]>;
  ev_charging_strategy?: Record<string, string>;
  estimated_budget: {
    stay: number;
    food: number;
    transport: number;
    activities: number;
    total: number;
  };
  budget_tips: string[];
  starting_location?: string;
}

function AIPlannerSection() {
  const [currentView, setCurrentView] = useState<'home' | 'my-trips'>('home');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<TripState | null>(null);
  const clerk = useClerk();
  const { isSignedIn, user } = useUser();

  // Form State
  const [destination, setDestination] = useState('');
  const [days, setDays] = useState(5);
  const [budget, setBudget] = useState('medium');
  const [travelStyles, setTravelStyles] = useState<string[]>(['adventure']);
  const [startingLocation, setStartingLocation] = useState('');
  const [specificLocations, setSpecificLocations] = useState('');
  const [travelMode, setTravelMode] = useState('train');

  // EV Custom State
  const [isEV, setIsEV] = useState(false);
  const [evBrand, setEvBrand] = useState('');
  const [evModel, setEvModel] = useState('');
  const [evBattery, setEvBattery] = useState('');
  const [evRange, setEvRange] = useState('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  // Hotel Booking State
  const [wantsHotel, setWantsHotel] = useState(false);
  const [checkInDate, setCheckInDate] = useState('');
  const [checkOutDate, setCheckOutDate] = useState('');
  const [rooms, setRooms] = useState(1);
  const [guests, setGuests] = useState(2);
  const [pricePerNight, setPricePerNight] = useState('2000-5000');



  // Trigger EV Connect Sound
  React.useEffect(() => {
    if (isEV) {
      const audio = new Audio('/magsafe_charge.mp3');
      audio.volume = 0.5;
      audio.play().catch(e => console.warn("Audio playback blocked by browser:", e));
    }
  }, [isEV]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResults(null);

    try {
      const response = await axios.post<TripState>(`${API_BASE_URL}/api/plan-trip`, {
        destination,
        days,
        budget,
        travel_style: travelStyles.join(', '),
        trip_type: 'national',
        starting_location: startingLocation,
        travel_mode: travelMode,
        specific_locations: specificLocations,
        // Optional EV Parameters
        is_ev: travelMode === 'car' && isEV,
        ev_brand: evBrand,
        ev_model: evModel,
        ev_battery: evBattery,
        ev_range: parseInt(evRange) || 0,
        // Optional Hotel Parameters
        wants_hotel: wantsHotel,
        check_in_date: checkInDate,
        check_out_date: checkOutDate,
        rooms: rooms,
        guests: guests,
        price_per_night: pricePerNight
      });
      setResults(response.data);
      setSaveStatus('idle'); // Reset save status on new trip
    } catch (err: any) {
      let errorMsg = 'An error occurred while connecting to the API.';
      if (err.response?.data?.detail) {
        if (Array.isArray(err.response.data.detail)) {
          // FastAPI validation array
          errorMsg = err.response.data.detail.map((e: any) => `${e.loc?.join('.')} ${e.msg}`).join('; ');
        } else if (typeof err.response.data.detail === 'string') {
          errorMsg = err.response.data.detail;
        } else {
          errorMsg = JSON.stringify(err.response.data.detail);
        }
      } else if (err.message) {
        errorMsg = err.message;
      }
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTrip = async () => {
    if (!isSignedIn) {
      // If not logged in, force open the sign IN/UP modal
      clerk.openSignUp({ forceRedirectUrl: window.location.href });
      return;
    }

    if (!user || !results) return;

    setSaveStatus('saving');
    try {
      await axios.post(`${API_BASE_URL}/api/trips/save`, {
        user_id: user.id,
        destination: destination,
        trip_data: results
      });
      setSaveStatus('saved');
    } catch (err) {
      console.error("Failed to save trip:", err);
      alert("Failed to save trip. Please try again.");
      setSaveStatus('idle');
    }
  };

  const handleOpenSavedTrip = (savedTripData: TripState) => {
    setResults(savedTripData);
    setCurrentView('home');
    setSaveStatus('saved');
    // Also scroll up to planner form if needed, they are already there though.
  };

  return (
    <ErrorBoundary>
      <motion.section
        id="planner"
        initial={{ opacity: 0, y: 50 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="w-full relative z-20 py-20 px-6 lg:px-12 !bg-brand-bg border-t border-gray-200/60 shadow-[0_-10px_40px_rgba(0,0,0,0.03)]"
      >
        <div className="max-w-7xl mx-auto flex flex-col items-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
            className="bg-white w-full max-w-5xl rounded-3xl shadow-xl overflow-hidden relative flex flex-col"
          >
            <div className="sticky top-0 bg-white/90 backdrop-blur-md z-20 px-4 md:px-8 py-4 border-b border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <h2 className="text-xl md:text-2xl font-bold tracking-tight text-brand-dark flex items-center gap-2">
                <span className="bg-brand-dark text-white p-1.5 rounded-lg"><Globe2 className="w-4 h-4 md:w-5 md:h-5" /></span>
                Plan Your Trip
              </h2>
              <div className="flex flex-wrap items-center gap-2 md:gap-4 w-full md:w-auto">
                <SignedIn>
                  <button
                    onClick={() => setCurrentView('my-trips')}
                    className={`flex items-center justify-center gap-2 px-4 py-2 rounded-full font-medium transition-colors ${currentView === 'my-trips' ? 'bg-brand-dark text-white shadow-md' : 'text-gray-600 hover:text-brand-dark hover:bg-gray-100'}`}
                  >
                    <History className="w-4 h-4" />
                    My Trips
                  </button>
                  <button
                    onClick={() => { setResults(null); setCurrentView('home'); }}
                    className={`flex items-center justify-center gap-2 px-4 py-2 rounded-full font-medium transition-colors ${currentView === 'home' && !results ? 'bg-brand-dark text-white shadow-md' : 'text-gray-600 hover:text-brand-dark hover:bg-gray-100'}`}
                  >
                    <Plane className="w-4 h-4" />
                    Plan a Trip
                  </button>
                </SignedIn>
              </div>
            </div>

            <div className="p-4 sm:p-6 md:p-8">
              {currentView === 'my-trips' ? (
                <SavedTripsDashboard onOpenTrip={handleOpenSavedTrip} />
              ) : !results ? (
                <form onSubmit={handleSubmit} className="space-y-8 max-w-3xl mx-auto">
                  {/* Re-using the excellent form from the original code, but styled for light theme */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* form fields (abbreviated styling for light theme) */}
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-brand-dark/70 uppercase tracking-wide">Starting Location</label>
                      <input type="text" required value={startingLocation} onChange={e => setStartingLocation(e.target.value)} placeholder="e.g., New Delhi" className="w-full px-5 py-4 rounded-xl bg-gray-50 border-2 border-transparent focus:bg-white focus:border-brand-dark outline-none transition-all" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-brand-dark/70 uppercase tracking-wide">Destination Area</label>
                      <input type="text" required value={destination} onChange={e => setDestination(e.target.value)} placeholder="e.g., Kerala or Europe" className="w-full px-5 py-4 rounded-xl bg-gray-50 border-2 border-transparent focus:bg-white focus:border-brand-dark outline-none transition-all" />
                    </div>
                    <div className="space-y-2 md:col-span-2 mt-[-1rem]">
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wide flex items-center gap-1">
                        Specific Cities/Places In Mind? <span className="font-normal normal-case opacity-70">(Optional)</span>
                      </label>
                      <input type="text" value={specificLocations} onChange={e => setSpecificLocations(e.target.value)} placeholder="e.g., Munnar, Kochi" className="w-full px-4 py-3 text-sm rounded-xl bg-gray-50/50 border border-gray-100 focus:bg-white focus:border-gray-300 outline-none transition-all placeholder:text-gray-400" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-brand-dark/70 uppercase tracking-wide">Duration (Days)</label>
                      <input type="number" required min="1" max="30" value={days} onChange={e => setDays(Number(e.target.value))} className="w-full px-5 py-4 rounded-xl bg-gray-50 border-2 border-transparent focus:bg-white focus:border-brand-dark outline-none transition-all" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-brand-dark/70 uppercase tracking-wide">Budget</label>
                      <select value={budget} onChange={e => setBudget(e.target.value)} className="w-full px-5 py-4 rounded-xl bg-gray-50 border-2 border-transparent focus:bg-white focus:border-brand-dark outline-none transition-all appearance-none">
                        <option value="budget">Budget Friendly (Backpacker)</option>
                        <option value="medium">Moderate (Comfort)</option>
                        <option value="luxury">Luxury (Premium)</option>
                      </select>
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-sm font-bold text-brand-dark/70 uppercase tracking-wide">Travel Style</label>
                      <div className="flex flex-wrap gap-2">
                        {[
                          { id: 'relaxed', label: 'Relaxed & Leisure' },
                          { id: 'adventure', label: 'Active & Adventure' },
                          { id: 'cultural', label: 'Historical & Cultural' },
                          { id: 'family', label: 'Family Friendly' },
                          { id: 'foodie', label: 'Food & Culinary' }
                        ].map(style => (
                          <button
                            key={style.id} type="button"
                            onClick={() => {
                              if (travelStyles.includes(style.id)) {
                                if (travelStyles.length > 1) setTravelStyles(travelStyles.filter(s => s !== style.id));
                              } else {
                                setTravelStyles([...travelStyles, style.id]);
                              }
                            }}
                            className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all border ${travelStyles.includes(style.id) ? 'bg-brand-dark text-white border-brand-dark shadow-md' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}
                          >
                            {style.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-sm font-bold text-brand-dark/70 uppercase tracking-wide">Preferred Travel Mode</label>
                      <select value={travelMode} onChange={e => setTravelMode(e.target.value)} className="w-full px-5 py-4 rounded-xl bg-gray-50 border-2 border-transparent focus:bg-white focus:border-brand-dark outline-none transition-all appearance-none cursor-pointer">
                        <option value="plane">Flight / Plane</option>
                        <option value="train">Train</option>
                        <option value="car">Car / Road Trip</option>
                        <option value="bike">Bike / Motorcycle</option>
                      </select>
                    </div>

                    {/* EV Integration Logic */}
                    {travelMode === 'car' && (
                      <div className="space-y-6 md:col-span-2 animate-fade-in bg-brand-lavender/30 p-6 rounded-2xl border border-brand-lavender/50">
                        <div className="flex items-center justify-between">
                          <label className="text-sm font-bold text-brand-dark uppercase tracking-wide flex items-center gap-2">
                            <Wallet className="w-5 h-5 text-brand-dark" /> Driving an Electric Vehicle (EV)?
                          </label>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" checked={isEV} onChange={(e) => {
                              setIsEV(e.target.checked);
                              if (!e.target.checked) {
                                setEvBrand(''); setEvModel(''); setEvBattery('');
                              }
                            }} className="sr-only peer" />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-dark"></div>
                          </label>
                        </div>

                        {isEV && (
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-fade-in mt-4">
                            {/* Brand Dropdown */}
                            <div className="space-y-2">
                              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Brand</label>
                              <select
                                required={isEV}
                                value={evBrand}
                                onChange={(e) => { setEvBrand(e.target.value); setEvModel(''); setEvBattery(''); }}
                                className="w-full px-4 py-3 rounded-xl bg-white border border-gray-200 focus:border-brand-dark outline-none transition-all appearance-none cursor-pointer text-sm"
                              >
                                <option value="" disabled>Select Brand...</option>
                                {Object.keys(EV_CARS).map(brand => (
                                  <option key={brand} value={brand}>{brand}</option>
                                ))}
                              </select>
                            </div>

                            {/* Model Dropdown */}
                            <div className="space-y-2">
                              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Model</label>
                              <select
                                required={isEV}
                                value={evModel}
                                onChange={(e) => { setEvModel(e.target.value); setEvBattery(''); }}
                                disabled={!evBrand}
                                className="w-full px-4 py-3 rounded-xl bg-white border border-gray-200 focus:border-brand-dark outline-none transition-all appearance-none disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                              >
                                <option value="" disabled>Select Model...</option>
                                {evBrand && Object.keys(EV_CARS[evBrand]).map(model => (
                                  <option key={model} value={model}>{model}</option>
                                ))}
                              </select>
                            </div>

                            {/* Battery Variant Dropdown */}
                            <div className="space-y-2">
                              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Battery Size</label>
                              <select
                                required={isEV}
                                value={evBattery}
                                onChange={(e) => setEvBattery(e.target.value)}
                                disabled={!evModel}
                                className="w-full px-4 py-3 rounded-xl bg-white border border-gray-200 focus:border-brand-dark outline-none transition-all appearance-none disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                              >
                                <option value="" disabled>Select Capacity...</option>
                                {evBrand && evModel && EV_CARS[evBrand][evModel].map(battery => (
                                  <option key={battery} value={battery}>{battery}</option>
                                ))}
                              </select>
                            </div>

                            {/* Optional Range Input */}
                            <div className="space-y-2 md:col-span-3 mt-2">
                              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Ideal Real-World Range (km) <span className="text-gray-400 font-normal ml-1">(Optional)</span></label>
                              <div className="relative">
                                <input
                                  type="number"
                                  min="50"
                                  value={evRange}
                                  onChange={(e) => setEvRange(e.target.value)}
                                  placeholder="e.g. 380"
                                  className="w-full px-4 py-3 rounded-xl bg-white border border-gray-200 focus:border-brand-dark outline-none transition-all text-sm"
                                />
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">km</div>
                              </div>
                              <p className="text-[11px] text-gray-500 font-medium">If provided, this overrides our default estimated range for your battery size, greatly improving charging accuracy.</p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Hotel Booking Integration */}
                    <div className="space-y-6 md:col-span-2 animate-fade-in bg-blue-50/50 p-6 rounded-2xl border border-blue-100">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-bold text-brand-dark uppercase tracking-wide flex items-center gap-2">
                          <Home className="w-5 h-5 text-brand-dark" /> Need Hotel Recommendations?
                        </label>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input type="checkbox" checked={wantsHotel} onChange={(e) => {
                            setWantsHotel(e.target.checked);
                          }} className="sr-only peer" />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                      </div>

                      {wantsHotel && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fade-in mt-4">
                          <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Check-in Date</label>
                            <input type="date" required={wantsHotel} value={checkInDate} onChange={(e) => setCheckInDate(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-white border border-gray-200 focus:border-blue-600 outline-none transition-all text-sm" />
                          </div>
                          <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Check-out Date</label>
                            <input type="date" required={wantsHotel} value={checkOutDate} onChange={(e) => setCheckOutDate(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-white border border-gray-200 focus:border-blue-600 outline-none transition-all text-sm" />
                          </div>
                          <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Guests</label>
                            <input type="number" min="1" required={wantsHotel} value={guests} onChange={(e) => setGuests(Number(e.target.value))} className="w-full px-4 py-3 rounded-xl bg-white border border-gray-200 focus:border-blue-600 outline-none transition-all text-sm" />
                          </div>
                          <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Rooms</label>
                            <input type="number" min="1" required={wantsHotel} value={rooms} onChange={(e) => setRooms(Number(e.target.value))} className="w-full px-4 py-3 rounded-xl bg-white border border-gray-200 focus:border-blue-600 outline-none transition-all text-sm" />
                          </div>
                          <div className="space-y-2 md:col-span-2">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Price Per Night Range (₹)</label>
                            <select value={pricePerNight} onChange={(e) => setPricePerNight(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-white border border-gray-200 focus:border-blue-600 outline-none transition-all appearance-none cursor-pointer text-sm">
                              <option value="1000-3000">₹1,000 - ₹3,000 (Budget)</option>
                              <option value="3000-6000">₹3,000 - ₹6,000 (Standard)</option>
                              <option value="6000-12000">₹6,000 - ₹12,000 (Premium)</option>
                              <option value="12000-25000">₹12,000 - ₹25,000 (Luxury)</option>
                              <option value="25000+">₹25,000+ (Ultra Luxury)</option>
                            </select>
                          </div>
                        </div>
                      )}
                    </div>


                  </div>

                  {error && (
                    <div className="bg-red-50 text-red-700 p-4 rounded-xl flex gap-3 text-sm font-medium">
                      <AlertCircle className="w-5 h-5 shrink-0" /> {error}
                    </div>
                  )}

                  <button
                    type="submit" disabled={loading}
                    className="w-full mt-4 bg-brand-dark hover:bg-black text-white px-8 py-5 rounded-xl font-bold tracking-wide text-lg transition-all disabled:opacity-70 disabled:cursor-not-allowed shadow-xl flex justify-center items-center gap-3"
                  >
                    {loading ? <><Loader2 className="w-6 h-6 animate-spin" /> Drafting itinerary...</> : <>Start Journey <ArrowRight className="w-5 h-5" /></>}
                  </button>
                </form>
              ) : null}

              {/* Results Display Area */}
              {results && !loading && (
                <div className="space-y-12 animate-fade-in">
                  <header className="text-center py-6 border-b border-gray-100 mb-8 relative">
                    <h1 className="text-4xl font-extrabold text-brand-dark tracking-tight">Your Personalized Escape</h1>
                    <div className="flex bg-gray-100 rounded-full w-fit mx-auto mt-6 p-1 relative z-10">
                      <button onClick={() => setResults(null)} className="px-5 py-2 hover:bg-white hover:shadow-sm text-brand-dark font-semibold rounded-full transition-all text-sm flex items-center gap-2">
                        Plan Another Trip
                      </button>
                      <button
                        onClick={handleSaveTrip}
                        disabled={saveStatus === 'saved'}
                        className={`px-5 py-2 font-semibold rounded-full transition-all text-sm flex items-center gap-2 ${saveStatus === 'saved' ? 'bg-green-100 text-green-700 cursor-default' : 'hover:bg-white hover:shadow-sm text-brand-dark'}`}
                      >
                        {saveStatus === 'saving' ? <Loader2 className="w-4 h-4 animate-spin" /> :
                          saveStatus === 'saved' ? <CheckCircle2 className="w-4 h-4" /> :
                            null}
                        {saveStatus === 'saving' ? 'Saving...' :
                          saveStatus === 'saved' ? 'Trip Saved!' :
                            'Save Trip'}
                      </button>
                    </div>
                  </header>

                  {/* Destinations & Attractions */}
                  <section className="bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-gray-100">
                    <h2 className="text-2xl font-bold mb-6 flex items-center gap-3"><MapPin className="text-brand-accent" /> Main Destinations</h2>
                    <div className="flex flex-wrap gap-2 mb-6">
                      {(results.destinations || []).map((d, i) => (
                        <span key={i} className="px-4 py-2 bg-brand-lavender/50 text-brand-dark font-semibold rounded-lg text-sm">{d}</span>
                      ))}
                    </div>
                    <div className="grid md:grid-cols-2 gap-6">
                      {typeof results.top_attractions === 'object' && Object.entries(results.top_attractions || {}).map(([place, acts]) => (
                        <div key={place} className="bg-gray-50 p-6 rounded-xl">
                          <h3 className="font-bold text-lg mb-4">{place}</h3>
                          <ul className="space-y-2">
                            {(Array.isArray(acts) ? acts : (acts ? [acts] : [])).map((act, i) => (
                              <li key={i} className="flex gap-2 text-sm text-gray-700"><CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" /> {act}</li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </section>

                  {/* Recommended Hotels (if requested) */}
                  {results?.recommended_hotels && typeof results.recommended_hotels === 'object' && Object.keys(results.recommended_hotels).length > 0 && (
                    <section className="bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-blue-100 relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-bl-full z-0 opacity-50" />
                      <h2 className="text-2xl font-bold mb-6 flex items-center gap-3 relative z-10"><Home className="text-blue-600" /> Recommended Hotels</h2>
                      <div className="grid md:grid-cols-2 gap-6 relative z-10">
                        {typeof results.recommended_hotels === 'object' && Object.entries(results.recommended_hotels).map(([place, hotels]) => (
                          <div key={place} className="bg-blue-50/50 p-6 rounded-xl border border-blue-100">
                            <h3 className="font-bold text-lg mb-4 text-blue-900">{place}</h3>
                            <ul className="space-y-4">
                              {(Array.isArray(hotels) ? hotels : (hotels ? [hotels] : [])).map((hotel, i) => {
                                const hotelStr = typeof hotel === 'string' ? hotel : JSON.stringify(hotel);
                                const hotelName = hotelStr.split('-')[0].trim() || 'hotel';
                                const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(hotelName + ' hotel ' + place)}`;
                                return (
                                  <li key={i}>
                                    <a
                                      href={searchUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex gap-3 text-sm text-gray-800 bg-white p-4 rounded-lg shadow-sm border border-blue-50 hover:border-blue-400 hover:shadow-md transition-all group cursor-pointer"
                                    >
                                      <Home className="w-5 h-5 text-blue-500 shrink-0 mt-0.5 group-hover:scale-110 transition-transform" />
                                      <div className="flex flex-col w-full">
                                        <span className="leading-relaxed text-gray-800 group-hover:text-blue-950 transition-colors">{hotelStr}</span>
                                        <span className="text-blue-600 font-semibold text-xs mt-1.5 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0">
                                          Check on Web &rarr;
                                        </span>
                                      </div>
                                    </a>
                                  </li>
                                );
                              })}
                            </ul>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}
                  {/* Itinerary */}
                  <section className="bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-gray-100">
                    <h2 className="text-2xl font-bold mb-8 flex items-center gap-3"><Calendar className="text-brand-accent" /> Itinerary</h2>
                    <div className="space-y-6">
                      {typeof results.day_wise_plan === 'object' && Object.entries(results.day_wise_plan || {})
                        .sort((a, b) => (parseInt(a[0]?.replace(/\D/g, '') || '0') || 0) - (parseInt(b[0]?.replace(/\D/g, '') || '0') || 0))
                        .map(([day, acts]) => (
                          <div key={day} className="flex gap-6">
                            <div className="flex flex-col items-center">
                              <div className="w-3 h-3 rounded-full bg-brand-dark mb-2" />
                              <div className="w-0.5 bg-gray-200 flex-1" />
                            </div>
                            <div className="flex-1 pb-6">
                              <h3 className="text-xl font-bold mb-3">{day}</h3>
                              <div className="bg-gray-50 p-5 rounded-xl border border-gray-100">
                                <ul className="space-y-3">
                                  {(Array.isArray(acts) ? acts : (acts ? [acts] : [])).map((item, i) => (
                                    <li key={i} className="flex gap-2 text-gray-700 text-sm leading-relaxed">
                                      <span className="text-gray-400 font-medium">&bull;</span> {item}
                                    </li>
                                  ))}
                                </ul>

                                {/* EV Charging Strategy (if exists) */}
                                {typeof results.ev_charging_strategy === 'object' && results.ev_charging_strategy !== null && results.ev_charging_strategy[day] && (
                                  <div className="mt-4 bg-blue-50/80 p-4 rounded-xl border border-blue-100 flex gap-3">
                                    <div className="bg-blue-100 p-2 rounded-lg h-fit">
                                      <Zap className="w-5 h-5 text-blue-600 fill-blue-600/20" />
                                    </div>
                                    <div>
                                      <h4 className="font-bold text-sm text-blue-900 mb-1">EV Charging Strategy</h4>
                                      <p className="text-sm text-blue-800/80 leading-relaxed">
                                        {results.ev_charging_strategy[day]}
                                      </p>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  </section>

                  {/* Budget */}
                  <section className="bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-gray-100">
                    <h2 className="text-2xl font-bold mb-6 flex items-center gap-3"><Wallet className="text-brand-accent" /> Budget Breakdown</h2>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                      {results.estimated_budget && typeof results.estimated_budget === 'object' && Object.entries(results.estimated_budget).filter(([k]) => k !== 'total').map(([key, val]) => (
                        <div key={key} className="bg-gray-50 p-4 rounded-xl text-center">
                          <span className="block text-xs uppercase font-bold text-gray-500 mb-2">{key}</span>
                          <span className="text-xl font-bold">₹{Number(val).toLocaleString('en-IN')}</span>
                        </div>
                      ))}
                    </div>
                  </section>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </motion.section>
    </ErrorBoundary>
  );
}

function App() {
  return (
    <div className="min-h-screen bg-brand-bg font-sans text-brand-dark relative overflow-x-hidden flex flex-col">
      {/* Decorative Wavy Background SVG */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <svg viewBox="0 0 1440 800" className="absolute bottom-0 left-0 w-full h-[80%] min-h-[600px] object-cover object-bottom opacity-80" preserveAspectRatio="none">
          <path
            fill="#E9E4F0"
            d="M0,400 C300,500 450,100 700,300 C950,500 1200,200 1440,350 L1440,800 L0,800 Z"
          />
          <path
            fill="none"
            stroke="#D3CADB"
            strokeWidth="8"
            d="M-100,250 C200,350 350,-50 600,150 C850,350 1100,50 1500,250"
          />
          <path
            fill="none"
            stroke="#D3CADB"
            strokeWidth="4"
            opacity="0.5"
            d="M-100,300 C200,400 350,0 600,200 C850,400 1100,100 1500,300"
          />
        </svg>
      </div>

      {/* Navbar */}
      <header className="relative z-10 px-4 sm:px-6 lg:px-12 py-4 md:py-6 flex items-center justify-between">
        <div className="flex items-center gap-2 font-bold text-xl tracking-tight">
          <img src="/logo.png" alt="Routewise Logo" className="h-12 sm:h-16 md:h-[90px] w-auto object-contain mix-blend-multiply origin-left scale-110" />
        </div>

        {/* Authentication Section */}
        <div className="flex items-center gap-4">
          <SignedOut>
            <SignInButton mode="modal">
              <button className="border-2 border-brand-dark rounded-full px-6 py-2 text-sm font-semibold hover:bg-brand-dark hover:text-white transition-all">
                Sign In
              </button>
            </SignInButton>
          </SignedOut>
          <SignedIn>
            {/* My Trips Button added here */}
            <button
              onClick={() => {
                const modalEvent = new CustomEvent('open-planner');
                window.dispatchEvent(modalEvent);
                // Since we are outside the modal state, we use an event to trigger the view naturally in the next render cycle, 
                // or rely on a global state if preferred. For simplicity, we'll let the modal open first, but it opens in 'home'.
                // To fix this perfectly, we should elevate currentView state to App, but for now we'll put the "My Trips" button INSIDE 
                // the modal nav as well. 
              }}
              className="hidden" // Hiding this external one since state is inside the modal. 
            // We'll place the actual "My Trips" button inside the AIPlannerModal header.
            />
            <UserButton appearance={{ elements: { userButtonAvatarBox: "w-10 h-10 border-2 border-brand-dark" } }} />
          </SignedIn>
        </div>
      </header>

      {/* Hero Section */}
      <main className="relative z-10 flex-1 flex flex-col lg:flex-row items-center justify-center lg:justify-between max-w-7xl mx-auto w-full px-6 lg:px-12 pt-10 pb-20 min-h-[85vh] lg:min-h-0">

        {/* Left Content */}
        <div className="w-full lg:w-1/2 flex flex-col items-start gap-8 z-20">
          {/* Old Title Format (Saved for easy reversion) */}
          {/* <h1 className="text-7xl lg:text-[100px] leading-[0.9] font-black tracking-tighter text-brand-dark uppercase">
            Plan your <br />
            <span className="italic font-medium">Escape</span>
          </h1> */}

          {/* New Title Format */}
          <h1 className="text-5xl sm:text-6xl lg:text-[80px] leading-[1.1] font-black tracking-tight text-brand-dark uppercase">
            Plan your <span className="italic font-medium">Escape</span> <br />
            <span className="text-2xl sm:text-3xl lg:text-5xl text-black font-normal tracking-normal mt-2 lg:mt-4 block">— Without the planning stress</span>
          </h1>

          <p className="text-lg md:text-xl font-medium text-brand-dark/80 max-w-md leading-relaxed">
            From discovering destinations to optimizing routes and managing costs, your entire trip — perfectly planned.
          </p>

          <button
            onClick={() => document.getElementById('planner')?.scrollIntoView({ behavior: 'smooth' })}
            className="animated-btn bg-brand-dark hover:bg-black text-white font-semibold text-lg cursor-pointer mt-4"
          >
            <span className="btn-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 16 16">
                <path d="M6.428 1.151C6.708.591 7.213 0 8 0s1.292.592 1.572 1.151C9.861 1.73 10 2.431 10 3v3.691l5.17 2.585a1.5 1.5 0 0 1 .83 1.342V12a.5.5 0 0 1-.582.493l-5.507-.918-.375 2.253 1.318 1.318A.5.5 0 0 1 10.5 16h-5a.5.5 0 0 1-.354-.854l1.319-1.318-.376-2.253-5.507.918A.5.5 0 0 1 0 12v-1.382a1.5 1.5 0 0 1 .83-1.342L6 6.691V3c0-.568.14-1.271.428-1.849Z"></path>
              </svg>
            </span>
            <span className="btn-text">Begin the Adventure</span>
          </button>
        </div>

        {/* Right Content - Phone Mockup (Hidden on Mobile) */}
        <div className="hidden lg:flex w-full lg:w-1/2 justify-center lg:justify-end mt-16 lg:mt-0 z-20 perspective-1000">
          <div className="transform scale-[0.85] sm:scale-100 origin-top flex justify-center">
            <div className="relative w-[300px] sm:w-[340px] h-[600px] sm:h-[700px] bg-[#97D4E7] rounded-[2.5rem] sm:rounded-[3rem] border-[10px] sm:border-[14px] border-[#313036] shadow-2xl overflow-hidden flex flex-col transform md:rotate-y-[-5deg] md:rotate-z-[2deg] transition-transform duration-500 hover:rotate-0">
              {/* Phone Top / Dynamic Island */}
              <div className="absolute top-0 w-full h-8 flex justify-center items-start pt-3 z-30">
                <div className="w-28 h-7 bg-black rounded-full flex items-center justify-center -mt-1 shadow-inner relative z-50">
                  <div className="w-2 h-2 rounded-full bg-blue-900/40 absolute left-4"></div>
                </div>
              </div>
              {/* Status Bar */}
              <div className="absolute top-4 left-6 right-6 flex justify-between items-center text-xs font-semibold z-20 text-brand-dark">
                <span>9:41</span>
                <div className="flex items-center gap-1.5 opacity-80">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21L15.6 16.2C14.6 15.4 13.3 15 12 15C10.7 15 9.4 15.4 8.4 16.2L12 21ZM12 3C7.9 3 4.2 4.6 1.4 7.2L3.2 9.6C5.5 7.4 8.6 6 12 6C15.4 6 18.5 7.4 20.8 9.6L22.6 7.2C19.8 4.6 16.1 3 12 3Z" /></svg>
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M15.67 4H14V2H10V4H8.33C7.6 4 7 4.6 7 5.33V20.67C7 21.4 7.6 22 8.33 22H15.67C16.4 22 17 21.4 17 20.67V5.33C17 4.6 16.4 4 15.67 4Z" /></svg>
                </div>
              </div>

              {/* Decorative line on blue background */}
              <svg className="absolute top-12 left-0 w-full z-0 opacity-40 mix-blend-overlay" viewBox="0 0 340 100" fill="none">
                <path d="M-20,80 C80,20 180,120 280,40 C330,0 360,20 360,20" stroke="white" strokeWidth="2" strokeLinecap="round" />
              </svg>

              {/* Phone Content */}
              <div className="flex-1 mt-20 px-6 z-10 flex flex-col">
                <h2 className="text-2xl font-bold mb-4">My Trips</h2>

                <div className="flex gap-4 text-xs font-bold uppercase tracking-wide text-brand-dark/60 mb-6">
                  <span className="text-brand-dark border-b-2 border-brand-dark pb-1">Upcoming</span>
                  <span>Wishlist</span>
                  <span>Recently Viewed</span>
                </div>

                {/* White Card */}
                <div className="bg-white rounded-2xl p-4 mb-4 shadow-sm border border-gray-100">
                  <span className="text-[#888] text-[10px] font-semibold uppercase tracking-wider mb-1 block">Tips for your trip</span>
                  <h3 className="font-bold text-sm mb-2">Make copies of important documents</h3>
                  <p className="text-[10px] text-gray-500 leading-relaxed">
                    Make extra copies of your passport and important documents. Place them in your luggage and/or keep photos of them on your phone.
                  </p>
                  <div className="flex gap-1 justify-center mt-3">
                    <div className="w-1 h-1 bg-black rounded-full" />
                    <div className="w-1 h-1 bg-gray-300 rounded-full" />
                    <div className="w-1 h-1 bg-gray-300 rounded-full" />
                    <div className="w-1 h-1 bg-gray-300 rounded-full" />
                  </div>
                </div>

                {/* Green Card */}
                <div className="bg-[#EAECE0] rounded-2xl p-5 flex-1 shadow-sm relative overflow-hidden flex flex-col">
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="font-bold text-lg">Exotic Bali</h3>
                    <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center shadow-sm">
                      <ChevronDown className="w-4 h-4 text-gray-400 rotate-180" />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mb-6 text-[10px] font-medium text-brand-dark">
                    <div className="flex -space-x-2">
                      <div className="w-6 h-6 rounded-full bg-blue-400 border border-white"></div>
                      <div className="w-6 h-6 rounded-full bg-yellow-400 border border-white flex justify-center items-center text-[8px]">S</div>
                      <div className="w-6 h-6 rounded-full bg-orange-400 border border-white flex justify-center items-center text-[8px]">K</div>
                      <div className="w-6 h-6 rounded-full bg-white border border-gray-200 flex items-center justify-center text-[8px] text-gray-600">+6</div>
                    </div>
                    <span className="ml-1 opacity-70">10 friends have been there</span>
                  </div>

                  <div className="flex items-start gap-1.5 mb-4 text-[11px] font-medium">
                    <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <span>The Bali Dream Villa & Resort Echo Beach</span>
                  </div>

                  <div className="flex justify-between items-center mb-6 text-xs mt-auto">
                    <span className="font-semibold">Nov 24 - Dec 2</span>
                    <button className="px-3 py-1.5 border border-brand-dark/20 rounded-full text-[10px] font-semibold hover:bg-white transition-colors tracking-wide">Explore</button>
                  </div>

                  {/* Sub Card */}
                  <div className="bg-[#DDE2C6] rounded-xl p-3 flex gap-3 relative before:absolute before:left-[-1px] before:top-[-10px] before:bottom-6 before:w-[2px] before:bg-brand-dark/20 before:rounded">
                    <div className="absolute left-[-4.5px] top-[-10px] w-2 h-2 rounded-full border-2 border-brand-dark/30 bg-[#EAECE0] z-10" />
                    <div className="w-16 h-16 bg-gray-300 rounded-lg overflow-hidden shrink-0">
                      <img src="https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&q=80&w=200" className="w-full h-full object-cover" alt="Monkey Forest" />
                    </div>
                    <div className="flex flex-col justify-center">
                      <h4 className="font-bold text-xs mb-1">Ubud Monkey Forest</h4>
                      <div className="flex flex-col gap-1 text-[10px] text-brand-dark/70">
                        <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> Nov 24</span>
                        <span className="flex items-center gap-1"><User className="w-3 h-3" /> 2 adults</span>
                      </div>
                    </div>
                  </div>

                </div>
              </div>

              {/* Bottom Nav */}
              <div className="h-16 bg-white w-full z-20 flex justify-around items-center px-4 pt-1 pb-2 shadow-[0_-10px_20px_rgba(0,0,0,0.05)] text-[10px] text-gray-400 font-semibold mb-2">
                <div className="flex flex-col items-center gap-1"><Home className="w-5 h-5" /> Home</div>
                <div className="flex flex-col items-center gap-1"><Briefcase className="w-5 h-5" /> Book</div>
                <div className="flex flex-col items-center gap-1 text-black relative">
                  <Map className="w-5 h-5" /> My Trips
                  <div className="w-1 h-1 bg-black rounded-full absolute -bottom-2" />
                </div>
                <div className="flex flex-col items-center gap-1"><User className="w-5 h-5" /> Profile</div>
              </div>
              {/* Home indicator */}
              <div className="absolute bottom-2 w-full flex justify-center z-30">
                <div className="w-32 h-1 bg-black rounded-full" />
              </div>
            </div>
          </div>
        </div>

      </main>

      {/* AI Planner Section Below Hero */}
      <AIPlannerSection />

    </div>
  );
}

// -------------------------------------------------------------
// NEW: Saved Trips Dashboard Component
// -------------------------------------------------------------
function SavedTripsDashboard({ onOpenTrip }: { onOpenTrip: (trip: TripState) => void }) {
  const { user } = useUser();
  const [savedTrips, setSavedTrips] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  React.useEffect(() => {
    if (!user) return;

    // Fetch trips from MongoDB Backend
    axios.get(`${API_BASE_URL}/api/trips/${user.id}`)
      .then(res => {
        setSavedTrips(res.data.trips || []);
      })
      .catch(err => {
        console.error(err);
        setError("Failed to load saved trips.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [user]);

  if (loading) {
    return (
      <div className="w-full max-w-5xl mx-auto flex flex-col items-center justify-center min-h-[400px]">
        <Loader2 className="w-10 h-10 animate-spin text-brand-dark mb-4" />
        <p className="text-gray-500 font-medium">Fetching your adventures from MongoDB Atlas...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full max-w-5xl mx-auto p-8 bg-red-50 text-red-700 rounded-2xl flex items-center justify-center">
        <AlertCircle className="w-6 h-6 mr-3" />
        <span className="font-semibold">{error}</span>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="w-full max-w-5xl mx-auto space-y-8 pb-12"
    >
      <header className="mb-10 text-center">
        <h1 className="text-4xl font-extrabold text-brand-dark tracking-tight mb-2">My Saved Trips</h1>
        <p className="text-gray-500 font-medium">Revisit your generated itineraries and prepare for takeoff.</p>
      </header>

      {savedTrips.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="text-center py-20 bg-gray-50/50 rounded-3xl border-2 border-dashed border-gray-200"
        >
          <div className="w-20 h-20 bg-white rounded-full mx-auto flex items-center justify-center shadow-sm mb-6">
            <Map className="w-10 h-10 text-gray-400" />
          </div>
          <h3 className="text-xl font-bold text-brand-dark mb-2">No trips saved yet</h3>
          <p className="text-gray-500 max-w-sm mx-auto">Generate a new itinerary and click "Save Trip" to keep it forever in your cloud database.</p>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {savedTrips.map((trip, idx) => (
            <motion.div
              key={trip.id}
              initial={{ opacity: 0, scale: 0.95, y: 30 }}
              whileInView={{ opacity: 1, scale: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, delay: idx * 0.1 }}
              className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 hover:shadow-xl hover:border-brand-dark/20 hover:-translate-y-1 transition-all duration-300 flex flex-col group h-full"
            >

              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-brand-bg rounded-xl flex items-center justify-center group-hover:bg-brand-dark group-hover:text-white transition-colors duration-300">
                  <MapPin className="w-6 h-6 text-brand-dark group-hover:text-white" />
                </div>
                <span className="px-3 py-1 bg-gray-100 text-gray-600 text-xs font-bold uppercase tracking-wider rounded-full">
                  {new Date(trip.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              </div>

              <h3 className="text-2xl font-bold text-brand-dark mb-2">{trip.destination}</h3>

              <p className="text-gray-500 text-sm font-medium mb-6 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-400" />
                {Object.keys(trip.trip_data?.day_wise_plan || {}).length} Days Planned
              </p>

              <div className="mt-auto pt-6 border-t border-gray-100">
                <button
                  onClick={() => onOpenTrip(trip.trip_data)}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-brand-bg text-brand-dark font-semibold rounded-xl hover:bg-brand-dark hover:text-white transition-colors"
                >
                  View Itinerary
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

export default App;
