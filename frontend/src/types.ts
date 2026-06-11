export interface AuthData {
  token: string;
  email: string | null;
  company_name: string;
  has_data: boolean;
}

export interface Device {
  device_sn: string;
  company_name: string | null;
  location_name: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  region_code: string | null;
}

export interface HeatLevel {
  code: string;
  label: string;
  color: string;
  rank: number;
}

export interface Kpi {
  device_sn: string | null;
  company_name: string | null;
  location_name: string | null;
  range_start: string | null;
  range_end: string | null;
  record_count: number;
  max_feels_like: number | null;
  max_temperature: number | null;
  avg_humidity: number | null;
  avg_feels_like: number | null;
  current_level: HeatLevel;
  thresholds: Record<string, number>;
}

export interface SeriesPoint {
  t: string;
  temperature: number | null;
  feels_like: number | null;
  humidity: number | null;
}

export interface TimeSeries {
  device_sn: string;
  interval_minutes: number;
  points: SeriesPoint[];
}

export interface CurrentWeather {
  provider: string;
  available: boolean;
  source: string;
  region: string | null;
  outdoor_temp: number | null;
  outdoor_feels: number | null;
  outdoor_humidity: number | null;
  outdoor_level: HeatLevel | null;
  observed_at: string | null;
  indoor_feels: number | null;
  indoor_temp: number | null;
  indoor_at: string | null;
  delta: number | null;
  enclosed_alert: boolean;
  enclosed_threshold: number;
  message: string | null;
}

export interface WeatherComparePoint {
  t: string;
  indoor_feels_like: number | null;
  outdoor_temperature: number | null;
  delta: number | null;
}

export interface WeatherCompare {
  device_sn: string;
  provider: string;
  interval_minutes: number;
  points: WeatherComparePoint[];
  max_delta: number | null;
  enclosed_alert: boolean;
  enclosed_threshold: number;
}

export interface UploadResult {
  filename: string;
  rows_parsed: number;
  rows_inserted: number;
  rows_updated: number;
  rows_skipped: number;
  new_devices: string[];
  affected_devices: string[];
  min_date: string | null;
  max_date: string | null;
  encoding: string;
  errors: string[];
}

export interface DailyReport {
  device_sn: string;
  date: string;
  company_name: string | null;
  location_name: string | null;
  max_feels_like: number | null;
  max_feels_like_time: string | null;
  max_temperature: number | null;
  avg_humidity: number | null;
  minutes_over_33: number;
  minutes_over_35: number;
  minutes_over_38: number;
  peak_level: HeatLevel;
  guidance: string[];
}
