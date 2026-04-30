import { useState, useEffect } from 'react';
const API_KEY = import.meta.env.VITE_OPENWEATHER_API_KEY;
const WEATHER_DE = {
  'clear sky':'Sonnig','few clouds':'Leicht bewölkt','scattered clouds':'Bewölkt',
  'broken clouds':'Stark bewölkt','shower rain':'Schauer','rain':'Regen',
  'thunderstorm':'Gewitter','snow':'Schnee','mist':'Nebel','overcast clouds':'Bedeckt',
  'light rain':'Leichter Regen','moderate rain':'Mäßiger Regen',
};
export function useWeather() {
  const [state, setState] = useState({ temp:null, description:'', icon:'', city:'', loading:true, error:null });
  useEffect(() => {
    if (!API_KEY || API_KEY === 'placeholder' || !navigator.geolocation) {
      setState(s=>({...s,loading:false,error:'no-key'}));
      return;
    }
    navigator.geolocation.getCurrentPosition(async pos => {
      try {
        const { latitude: lat, longitude: lon } = pos.coords;
        const res = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${API_KEY}`);
        const d = await res.json();
        const desc = d.weather?.[0]?.description || '';
        setState({ temp:Math.round(d.main?.temp), description:WEATHER_DE[desc]||desc, icon:d.weather?.[0]?.icon, city:d.name, loading:false, error:null });
      } catch { setState(s=>({...s,loading:false,error:'fetch-failed'})); }
    }, () => setState(s=>({...s,loading:false,error:'geo-denied'})));
  }, []);
  return state;
}
