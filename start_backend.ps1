$ErrorActionPreference = 'Continue'
cd "C:\Users\PrakasamR\OneDrive - Ephicacy Lifesciences Analytics\Desktop\Nov25\EphiProj\ADAM_AI\backend"
& "C:\Users\PrakasamR\OneDrive - Ephicacy Lifesciences Analytics\Desktop\Nov25\EphiProj\ADAM_AI\prakenv\Scripts\python.exe" -m uvicorn app.main:app --host 0.0.0.0 --port 8002 --reload
