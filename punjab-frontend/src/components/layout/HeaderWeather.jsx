"use client";

import { useEffect, useState } from "react";
import { useIsClient } from "@/hooks/useIsClient";

const weatherIcons = {
  0: "☀️",
  1: "🌤️",
  2: "⛅",
  3: "☁️",
  45: "🌫️",
  48: "🌫️",
  51: "🌦️",
  53: "🌦️",
  55: "🌧️",
  56: "🌧️",
  57: "🌧️",
  61: "🌧️",
  63: "🌧️",
  65: "🌧️",
  66: "🌧️",
  67: "🌧️",
  71: "🌨️",
  73: "🌨️",
  75: "❄️",
  77: "❄️",
  80: "🌦️",
  81: "🌦️",
  82: "🌧️",
  85: "🌨️",
  86: "🌨️",
  95: "⛈️",
  96: "⛈️",
  99: "⛈️",
};

const weatherDescriptions = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Foggy",
  48: "Foggy",
  51: "Light drizzle",
  53: "Drizzle",
  55: "Heavy drizzle",
  61: "Light rain",
  63: "Rain",
  65: "Heavy rain",
  71: "Light snow",
  73: "Snow",
  75: "Heavy snow",
  80: "Rain showers",
  81: "Rain showers",
  82: "Heavy rain showers",
  85: "Snow showers",
  86: "Heavy snow showers",
  95: "Thunderstorm",
  96: "Thunderstorm",
  99: "Thunderstorm",
};

export default function HeaderWeather() {
  const isClient = useIsClient();
  const [weather, setWeather] = useState(null);
  const [location, setLocation] = useState("Bengaluru");
  const [dateTime, setDateTime] = useState(new Date());
  const [loading, setLoading] = useState(true);

  // -------------------------
  // DATE & TIME
  // -------------------------

  useEffect(() => {
    const timer = setInterval(() => {
      setDateTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // -------------------------
  // WEATHER
  // -------------------------

  useEffect(() => {
    const getWeather = async (latitude, longitude) => {
      try {
        // Get weather
        const weatherResponse = await fetch(
          `https://api.open-meteo.com/v1/forecast` +
            `?latitude=${latitude}` +
            `&longitude=${longitude}` +
            `&current=temperature_2m,apparent_temperature,weather_code` +
            `&timezone=auto`
        );

        if (!weatherResponse.ok) {
          throw new Error("Weather request failed");
        }

        const weatherData = await weatherResponse.json();

        setWeather(weatherData.current);

        // -------------------------
        // REVERSE GEOCODING
        // -------------------------
        // Open-Meteo only offers forward geocoding (search by name), not
        // reverse (lat/long -> place) — that endpoint never existed, hence
        // the permanent 404/fetch failure here. BigDataCloud's client-side
        // reverse-geocode endpoint is free, needs no API key, and is CORS-
        // enabled for direct browser use.

        const geoResponse = await fetch(
          `https://api.bigdatacloud.net/data/reverse-geocode-client` +
            `?latitude=${latitude}` +
            `&longitude=${longitude}` +
            `&localityLanguage=en`
        );

        if (geoResponse.ok) {
          const geoData = await geoResponse.json();

          setLocation(
            geoData.city ||
              geoData.locality ||
              geoData.principalSubdivision ||
              "Bengaluru"
          );
        }
      } catch (error) {
        console.error("Weather error:", error);

        setLocation("Bengaluru");
      } finally {
        setLoading(false);
      }
    };

    // -------------------------
    // GET USER LOCATION
    // -------------------------

    if (!navigator.geolocation) {
      // Bengaluru fallback
      getWeather(12.9716, 77.5946);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;

        getWeather(latitude, longitude);
      },

      () => {
        console.log("Location permission denied");

        // Bengaluru fallback
        getWeather(12.9716, 77.5946);
      },

      {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 10 * 60 * 1000,
      }
    );
  }, []);

  // -------------------------
  // FORMAT DATE
  // -------------------------

  const formattedDate = dateTime.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  // -------------------------
  // FORMAT TIME
  // -------------------------

  const formattedTime = dateTime.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  const weatherIcon = weather
    ? weatherIcons[weather.weather_code] || "🌤️"
    : "🌤️";

  const weatherDescription = weather
    ? weatherDescriptions[weather.weather_code] || "Weather"
    : "Loading...";

  return (
    <div className="hidden md:flex gap-1 pt-3 whitespace-nowrap">
      <div className="mx-auto flex flex-nowrap gap-5 max-w-3xl items-center justify-between px-3 py-1">

        {/* LEFT: LOCATION + WEATHER */}

      <div className="flex shrink-0 items-center gap-2 whitespace-nowrap text-xs font-label-md text-on-surface-variant">

          <div className="text-sm">
            {weatherIcon}
          </div>

          <div>
            <div className="flex items-center gap-2 font-headline-md text-xs text-primary">
              <span>{location}</span>

              {!loading && weather && (
                <>
                  <span className="text-gray-300">|</span>

                  <span>
                    {Math.round(weather.temperature_2m)}°C
                  </span>
                </>
              )}
            </div>

            
          </div>
        </div>

        {/* RIGHT: DATE + TIME */}

      <div className="flex shrink-0 items-center gap-3 whitespace-nowrap text-xs font-label-md text-on-surface-variant">

          <p className="text-xs text-gray-500 ">
            {isClient ? formattedDate : ""}
          </p>
        <span className="text-gray-300">|</span>
          <p className="font-headline-md text-xs text-primary">
            {isClient ? formattedTime : ""}
          </p>

        </div>

      </div>
    </div>
  );
}
