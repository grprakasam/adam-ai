$ErrorActionPreference = 'Continue'
cd "C:\Users\grpra\OneDrive\Desktop\Nov25\ADAM_AI\ADAMAINov25\backend"
& "C:\Users\grpra\OneDrive\Desktop\Nov25\ADAM_AI\ADAMAINov25\prakenv\Scripts\python.exe" -m uvicorn app.main:app --host 0.0.0.0 --port 8002 --reload
