# ADAM AI - Quick Start Guide

**Version:** 2.0.0
**Last Updated:** November 20, 2025

---

## 🚀 Getting Started

### 1. Start the Application

**Backend:**
```bash
cd backend
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Frontend:**
```bash
cd frontend
npm run dev
```

**Access:**
- Frontend: http://localhost:3001
- Backend API Docs: http://localhost:8000/api/docs

---

## 🔐 Login

### Default Credentials:

| Username | Password | Role |
|----------|----------|------|
| admin | admin | Administrator |
| developer | admin | Senior Developer |
| user | admin | Regular User |

**Login Page Features:**
- Auto-filled credentials for quick testing
- Session persistence
- Secure JWT authentication

---

## 🎯 Key Features & How to Use

### 1. Navigation System

**Top Navigation Bar:**
- **Left**: Home button, ADAM AI logo, Study selector
- **Right**: Search, Notifications, Dark Mode, User Menu

**Main Menus (Mega Menu Pattern):**

#### Code Generation
- **Pair Programming**: Generate AI code snippets
- **Consolidated Code**: View complete ADAM program
- **Traceability**: SDTM-to-ADAM lineage

#### Code Validation
- **Syntax Check**: Validate code syntax
- **P21 Validation**: Run P21 CE validation
- **CT Validation**: Controlled terminology checks

#### Submission Readiness
- **Define.xml**: Generate Define-XML 2.1
- **ADRG/SDRG**: Create reviewer guides
- **eCTD Package**: Package for submission

---

### 2. Global Search (Ctrl+K / Cmd+K)

**How to Use:**
1. Press **Ctrl+K** (Windows/Linux) or **Cmd+K** (Mac)
2. Type your search query
3. Results appear in real-time with icons and types
4. Click any result to navigate

**What You Can Search:**
- Variables (e.g., "AVAL", "PARAMCD")
- Code snippets
- Studies
- Datasets
- Help documentation

**Pro Tip:** Use quotes for exact matches: "ADSL"

---

### 3. Real-Time Notifications

**Bell Icon (Top Right):**
- **Badge**: Shows unread count
- **Dropdown**: Click to view all notifications
- **Actions**: Mark as read, view details, navigate to resource

**Notification Types:**
- 🔵 **Info**: General information
- ✅ **Success**: Operation completed
- ⚠️ **Warning**: Attention needed
- ❌ **Error**: Action failed

**Browser Notifications:**
- Click "Allow" when prompted
- Get desktop notifications even when tab is inactive

---

### 4. Dark Mode

**Toggle Dark Mode:**
1. Click the **moon/sun icon** in top right
2. Theme changes instantly
3. Preference saved to localStorage

**Features:**
- All components styled for dark mode
- Smooth transitions
- Reduced eye strain for long sessions

---

### 5. Study Management

**Study Selector:**
- **Location**: Top navigation bar (left side)
- **Purpose**: Switch between different clinical studies

**Create New Study:**
1. Click study selector dropdown
2. Click **"Create New Study"**
3. Fill in:
   - Study Name (e.g., "STUDY-001")
   - Sponsor
   - Therapeutic Area
   - Description
4. Click **Create**

**Switch Studies:**
1. Select different study from dropdown
2. Confirm switch (warning about unsaved work)
3. Workspace updates to new study context

---

### 6. P21 CE Docker Validation

**Access:** Code Validation → P21 Validation

**Prerequisites:**
1. Docker must be installed and running
2. P21 CE Docker image pulled

**Step-by-Step:**

**1. Check Docker Status:**
- Green alert: Docker is running
- Red alert: Start Docker Desktop

**2. Pull P21 Images (First Time Only):**
- Click **"Pull P21 Images"** button
- Wait for download to complete (~5-10 minutes)
- Image version displayed when ready

**3. Run Validation:**
- Click **"Run P21 Validation"**
- Optional: Click "Select Rules" to choose specific validation rules
- Monitor progress bar
- Wait for completion (may take several minutes)

**4. Review Results:**
- **Summary Statistics**: Total findings, errors, warnings, info
- **Results Table**:
  - Filter by severity (Error/Warning/Info)
  - Sort by any column
  - View variable, rule, message, record count
- **Export**: Click "Export Results (Excel)" for reporting

**Understanding Results:**
- 🔴 **Error**: Must be fixed (regulatory issue)
- ⚠️ **Warning**: Should be reviewed (best practice)
- ℹ️ **Info**: Informational (no action needed)

---

### 7. Admin Panel (Admin Users Only)

**Access:** User Menu → Admin Panel

**Dashboard Tab:**
- Total users / Active today
- Total studies
- Code generations count
- Success rate
- Average generation time
- Recent activity feed

**User Management Tab:**
- View all users
- Add new user
- Edit user details
- Change roles (user/developer/admin)
- Enable/disable accounts

**Audit Logs Tab (21 CFR Part 11):**
- Complete audit trail
- Filter by:
  - Date range
  - Action type (Create/Update/Delete)
  - User
- Export logs for regulatory submissions
- Checksum verification

**Templates Tab:**
- Manage code templates
- Document templates
- Validation rule templates
- Create/Edit/Clone/Delete

---

### 8. User Profile & Settings

**User Menu (Top Right):**
- **Profile Settings**: Update name, email, avatar
- **Change Password**: Secure password change
- **Theme Settings**: Customize appearance
- **My Activity**: View your recent actions
- **Help & Support**: Access help resources

---

## 🎨 Workflow Examples

### Workflow 1: Generate ADSL Code

1. **Login** as any user
2. **Select Study** from study selector
3. **Navigate**: Code Generation → Pair Programming
4. **Upload** specification file
5. **Review** categorized variables
6. **Approve** variables
7. **Generate** code snippets
8. **View**: Code Generation → Consolidated Code
9. **Download** or copy generated code

### Workflow 2: Run P21 Validation

1. **Login** with validation access
2. **Select Study** with datasets
3. **Navigate**: Code Validation → P21 Validation
4. **Check** Docker status (start if needed)
5. **Pull** P21 images (first time)
6. **Select** rules (optional)
7. **Run** validation
8. **Review** results
9. **Export** findings report
10. **Fix** errors in code
11. **Re-run** validation until clean

### Workflow 3: Create eCTD Package

1. **Complete** code generation
2. **Run** all validations (P21, CT)
3. **Review** validation results
4. **Navigate**: Submission Readiness → Define.xml
5. **Generate** Define-XML 2.1
6. **Navigate**: Submission Readiness → ADRG/SDRG
7. **Generate** reviewer guides
8. **Navigate**: Submission Readiness → eCTD Package
9. **Create** package
10. **Download** ZIP file
11. **Submit** to regulatory authority

### Workflow 4: Admin Tasks

1. **Login** as admin
2. **Navigate**: User Menu → Admin Panel
3. **Dashboard**: Monitor system health
4. **Users**: Add new user for project
5. **Audit Logs**: Review recent activity
6. **Export**: Generate compliance report

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| **Ctrl+K** / **Cmd+K** | Open global search |
| **ESC** | Close modal/drawer |
| **Tab** | Navigate between fields |
| **Enter** | Submit form |
| **Shift + /** | Open help center |

---

## 🐛 Troubleshooting

### Issue: Login Fails

**Solution:**
1. Check backend is running (port 8000)
2. Check console for errors (F12)
3. Clear browser cache
4. Try default credentials: admin/admin

### Issue: Docker Not Available

**Solution:**
1. Install Docker Desktop
2. Start Docker Desktop
3. Wait for Docker to initialize
4. Refresh status in P21 Validation panel

### Issue: WebSocket Not Connecting

**Solution:**
1. Check backend WebSocket endpoint
2. Check browser console for errors
3. Disable browser extensions (ad blockers)
4. Try different browser

### Issue: Search Not Working

**Solution:**
1. Type at least 2 characters
2. Wait for debounce (300ms)
3. Check backend search endpoint
4. Verify database has data

### Issue: Dark Mode Not Persisting

**Solution:**
1. Check localStorage is enabled
2. Clear browser cache
3. Re-toggle dark mode
4. Check for browser private mode

---

## 📞 Support

### Get Help

**In-App:**
- User Menu → Help & Support → Help Center
- User Menu → Help & Support → Send Feedback

**External:**
- GitHub Issues: https://github.com/your-org/adam-ai/issues
- Email: support@adamai.com
- Documentation: https://docs.adamai.com

---

## 🎓 Best Practices

### For Users

1. **Always select correct study** before starting work
2. **Save work frequently** (auto-save every 30s)
3. **Review validation results** before submission
4. **Use global search** to find features quickly
5. **Check notifications** for important updates

### For Developers

1. **Follow code review** process
2. **Run validations** on all generated code
3. **Document custom rules** and templates
4. **Test in dev environment** first
5. **Use version control** for code changes

### For Administrators

1. **Review audit logs** weekly
2. **Monitor system performance** daily
3. **Backup database** regularly
4. **Update dependencies** monthly
5. **Train new users** on features

---

## 📊 Feature Availability by Role

| Feature | User | Developer | Admin |
|---------|------|-----------|-------|
| Code Generation | ✅ | ✅ | ✅ |
| Code Validation | ✅ | ✅ | ✅ |
| P21 Validation | ✅ | ✅ | ✅ |
| Submission Readiness | ✅ | ✅ | ✅ |
| Study Management | ✅ | ✅ | ✅ |
| User Profile | ✅ | ✅ | ✅ |
| Notifications | ✅ | ✅ | ✅ |
| Global Search | ✅ | ✅ | ✅ |
| Dark Mode | ✅ | ✅ | ✅ |
| Admin Panel | ❌ | ❌ | ✅ |
| User Management | ❌ | ❌ | ✅ |
| Audit Logs | ❌ | ❌ | ✅ |
| System Statistics | ❌ | ❌ | ✅ |

---

## 🎯 Quick Reference Card

**Print this section for your desk!**

### Login
- URL: http://localhost:3001
- Admin: admin / admin

### Shortcuts
- Search: **Ctrl+K**
- Help: **Shift+/**
- Close: **ESC**

### Navigation
- Code Gen: Mega menu (left)
- Validation: Mega menu (center)
- Submission: Mega menu (right)

### Quick Actions
- New Study: Study selector → Create
- Notifications: Bell icon (top right)
- Dark Mode: Sun/Moon icon
- Profile: Avatar (top right)
- Admin: User menu → Admin Panel

### Support
- Help: User menu → Help & Support
- Feedback: help-support@adamai.com

---

**Happy Coding with ADAM AI! 🚀**
