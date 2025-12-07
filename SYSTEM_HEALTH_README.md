# ADAM Generator - System Health & Error Prevention

## Overview

Enhanced the ADAM Generator with comprehensive system health monitoring and improved error handling to provide users with clear, actionable feedback.

## New Features

### 1. System Health Panel

**Location:** Left sidebar in ADAM Generator Tab

**Features:**
- **Real-time Docker Status**: Shows if Docker is running and accessible
- **R Image Availability**: Displays available R versions and Docker images
- **Supported File Formats**: Lists accepted input/output formats
- **Health Score**: Overall system readiness indicator (0-100%)
- **Auto-refresh**: Updates every 30 seconds (configurable)
- **Manual Refresh**: Click refresh button to update immediately

**Health Indicators:**
- 🟢 **Excellent (90-100%)**: All systems operational
- 🟡 **Good (50-89%)**: Minor issues, may still work
- 🔴 **Critical (0-49%)**: Major issues, execution will fail

### 2. Pre-Execution Validation

**Automatic Checks Before Execution:**
1. Docker daemon availability
2. R Docker image availability
3. Disk space (minimum 1 GB)
4. System resources (CPU, memory)

**Validation Flow:**
1. User clicks "Execute" button
2. System runs comprehensive health check
3. If critical errors found:
   - Modal dialog shows detailed error messages
   - Provides specific suggestions for resolution
   - Execution is blocked
4. If only warnings:
   - Warning message displayed
   - Execution proceeds
5. If all checks pass:
   - Success message shown
   - Execution starts immediately

### 3. Enhanced Error Messages

**Improved Error Handling:**
- Specific error types caught (FileNotFoundError, PermissionError, etc.)
- Detailed error context provided
- Common causes explained
- Step-by-step troubleshooting guidance

**Example Error Messages:**

```
Docker executable not found.
Please ensure Docker Desktop is installed and added to your system PATH.
Error details: [specific error]
```

```
Docker execution failed with PermissionError.
Details: Permission denied when accessing files

Common causes:
1. Docker Desktop is not running (start it and wait 30-60 seconds)
2. Docker image not available (run: docker pull rocker/tidyverse:4.3.2)
3. Insufficient resources (check Docker Desktop settings)
4. File permission issues (ensure Docker can access workspace)
5. Network issues preventing image pull

For more help, check the Docker logs or contact support.
```

### 4. Supported File Formats

**Input Formats:**
- **R Scripts**: `.R`, `.r`
- **SDTM Datasets**: `.csv`, `.xpt`, `.sas7bdat`, `.txt`

**Output Formats:**
- **Datasets**: `.csv`, `.xlsx`
- **Plots**: `.png`

## API Endpoints

### System Health Validation
```
GET /api/v1/r-execution/validate
```

**Response:**
```json
{
  "is_valid": true,
  "checks": [
    {
      "is_valid": true,
      "message": "Docker is running and accessible",
      "severity": "info",
      "suggestion": null
    },
    {
      "is_valid": true,
      "message": "R Docker image 'rocker/tidyverse:4.3.2' is available",
      "severity": "info",
      "suggestion": null
    }
  ],
  "summary": "All checks passed - system is ready for execution"
}
```

### Environment Status
```
GET /api/v1/code-execution/environment-status
```

**Response:**
```json
{
  "docker_available": true,
  "r_image_available": true,
  "sas_image_available": false,
  "r_image_name": "rocker/tidyverse:latest",
  "sas_image_name": "sass/base:latest",
  "error_message": null
}
```

### R Versions
```
GET /api/v1/r-execution/versions
```

**Response:**
```json
[
  {
    "version": "4.3.2",
    "docker_image": "rocker/tidyverse:4.3.2",
    "is_default": true,
    "is_recommended": true
  },
  {
    "version": "4.4.0",
    "docker_image": "rocker/tidyverse:4.4.0",
    "is_default": false,
    "is_recommended": false
  }
]
```

## Troubleshooting Guide

### Docker Not Running

**Error:** "Docker is not running"

**Solution:**
1. Open Docker Desktop from Start menu or system tray
2. Wait 30-60 seconds for Docker to fully start
3. Refresh the System Health panel
4. Try execution again

### R Image Not Available

**Error:** "R Docker image not available"

**Solution:**
1. Click "Pull Image" in System Health panel, OR
2. Run in terminal: `docker pull rocker/tidyverse:4.3.2`
3. Wait for download to complete (may take several minutes)
4. Refresh System Health panel
5. Try execution again

### Permission Errors

**Error:** "Permission denied when accessing Docker or files"

**Windows:**
1. Open Docker Desktop
2. Go to Settings > Resources > File Sharing
3. Add the workspace directory
4. Apply & Restart
5. Try again

**Linux/Mac:**
1. Check file permissions: `ls -la`
2. Fix ownership: `sudo chown -R $USER:$USER .`
3. Try again

### Low Disk Space

**Error:** "Low disk space"

**Solution:**
1. Free up disk space (delete unused files, empty recycle bin)
2. Move large files to external drive
3. Clear Docker images: `docker system prune`
4. Restart and try again

### Low Memory

**Error:** "Low memory available"

**Solution:**
1. Close other applications
2. Increase Docker memory limit in Docker Desktop settings
3. Restart Docker Desktop
4. Try again

## Component Architecture

```
SystemHealthPanel.tsx
├── System Health Display
│   ├── Overall Health Score (Progress Circle)
│   ├── Docker Environment Status
│   │   ├── Docker Daemon
│   │   ├── R Image
│   │   └── SAS Image (optional)
│   ├── Available R Versions
│   ├── Supported File Formats
│   └── Troubleshooting Tips
└── Auto-refresh Logic

validation.py (Backend)
├── PreExecutionValidator
│   ├── _check_docker()
│   ├── _check_r_image()
│   ├── _check_disk_space()
│   └── _check_system_resources()
└── validate_system()

docker_runner.py (Backend)
├── Enhanced Error Handling
│   ├── FileNotFoundError → "Docker not installed"
│   ├── PermissionError → "Permission denied (file sharing)"
│   └── Generic Exception → Comprehensive error with solutions
└── Detailed Error Messages
```

## Configuration

### SystemHealthPanel Props

```typescript
interface SystemHealthPanelProps {
  refreshInterval?: number;  // Auto-refresh in seconds (0 = disabled)
  compact?: boolean;          // Compact view mode
}

// Usage
<SystemHealthPanel 
  refreshInterval={30}   // Refresh every 30 seconds
  compact={false}        // Full view
/>
```

### Validation Settings

Edit `backend/app/modules/r_execution/validation.py`:

```python
# Minimum disk space required (GB)
min_gb = 1.0

# Minimum available memory (GB)
if available_memory_gb < 0.5:  # 500 MB

# High CPU threshold
if cpu_percent > 90:  # 90%
```

## Benefits

1. **Prevents Failed Executions**: Catches issues before execution starts
2. **Reduces User Frustration**: Clear error messages with solutions
3. **Saves Time**: No waiting for failed executions
4. **Improves User Experience**: Visual health indicators and guidance
5. **Reduces Support Tickets**: Self-service troubleshooting
6. **Increases Reliability**: Proactive issue detection

## Future Enhancements

- [ ] Add network connectivity check
- [ ] Check available Docker resources (memory, CPU)
- [ ] Validate R package dependencies
- [ ] Add custom health check rules
- [ ] Email notifications for system issues
- [ ] Historical health metrics and trends
- [ ] Integration with monitoring systems

## Testing

### Manual Testing Scenarios

1. **Docker Not Running**
   - Stop Docker Desktop
   - Try to execute
   - Verify error message appears
   - Verify System Health Panel shows error

2. **R Image Missing**
   - Remove R image: `docker rmi rocker/tidyverse:4.3.2`
   - Try to execute
   - Verify error with pull suggestion
   - Click "Pull Image" button
   - Verify download progress

3. **Low Disk Space**
   - Fill disk to < 1 GB free
   - Try to execute
   - Verify warning message

4. **All Systems OK**
   - Ensure Docker running
   - Ensure R image available
   - Try to execute
   - Verify success message

## Support

For issues or questions:
- Check System Health panel for status
- Review error messages for suggestions
- Check Docker Desktop logs
- Contact support with error details
