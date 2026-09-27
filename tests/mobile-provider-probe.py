#!/usr/bin/env python3
"""Read-only HTTP probes at demonstration coordinates. No user geolocation,
no deployment, no credentials, and no attempt to bypass network restrictions."""
from pathlib import Path
import json,urllib.request,datetime
R=Path(__file__).resolve().parents[1];rows=[]
urls=[('forecast_demo','https://api.open-meteo.com/v1/forecast?latitude=40.71&longitude=-74.01&current=temperature_2m,apparent_temperature,precipitation,weather_code&temperature_unit=fahrenheit&timezone=auto'),('city_demo','https://geocoding-api.open-meteo.com/v1/search?name=Boston&count=2&language=en&format=json')]
for label,url in urls:
 try:
  with urllib.request.urlopen(url,timeout=10) as response:
   data=json.load(response);rows.append({'probe':label,'status':response.status,'success':response.status==200 and not data.get('error',False),'cors_allow_origin':response.headers.get('Access-Control-Allow-Origin')})
 except Exception as e:rows.append({'probe':label,'success':False,'error':str(e)})
r={'status':'PASS'if all(x['success']for x in rows)else'UNAVAILABLE','scope':__doc__,'probes':rows,'phone_test':False,'user_location_accessed':False}
(R/'evidence/mobile_v1_17_1/PROVIDER_HTTP.json').write_text(json.dumps(r,indent=2)+'\n');print(json.dumps(r,indent=2))
