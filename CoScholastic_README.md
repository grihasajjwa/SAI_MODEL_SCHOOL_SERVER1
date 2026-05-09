# Co-Scholastic Configuration System

This document describes the Co-Scholastic configuration system that allows schools to dynamically configure co-scholastic activities for different classes and sections.

## Overview

The Co-Scholastic configuration system provides:
- Dynamic configuration of co-scholastic activities per class/section
- Customizable activity labels and enable/disable functionality
- Database-driven configuration with fallback to defaults
- RESTful API endpoints for CRUD operations

## Database Schema

### CoScholasticConfig Model

```javascript
{
    class: String (required),
    section: String (required), 
    academicYear: String (required),
    activities: [{
        id: String (required),
        label: String (required),
        enabled: Boolean (required, default: true)
    }],
    createdAt: Date (default: Date.now),
    updatedAt: Date (default: Date.now)
}
```

### Unique Index

The model has a compound unique index on `{ class, section, academicYear }` to ensure one configuration per class-section-year combination.

## API Endpoints

### Base URL: `/api/coscholastic`

#### 1. Get Configuration
```
GET /config/:className/:section/:academicYear
```

**Description:** Retrieves co-scholastic configuration for a specific class, section, and academic year.

**Response:** 
- If configuration exists: Returns the stored configuration
- If no configuration exists: Returns default configuration with basic activities

**Default Configuration:**
```json
{
    "activities": [
        { "id": "artEducation", "label": "Art Education", "enabled": true },
        { "id": "recitation", "label": "Recitation / Rhymes", "enabled": true },
        { "id": "handwriting", "label": "Handwriting", "enabled": true },
        { "id": "punctuality", "label": "Punctuality", enabled: true },
        { "id": "discipline", "label": "Discipline", enabled: true },
        { "id": "generalKnowledge", "label": "General Knowledge", enabled: true }
    ]
}
```

#### 2. Save Configuration
```
POST /config
```

**Description:** Creates or updates co-scholastic configuration for a class.

**Request Body:**
```json
{
    "class": "I",
    "section": "A", 
    "academicYear": "2024-2025",
    "activities": [
        { "id": "artEducation", "label": "Art Education", "enabled": true },
        { "id": "recitation", "label": "Recitation / Rhymes", "enabled": true },
        { "id": "handwriting", "label": "Handwriting", "enabled": true }
    ]
}
```

#### 3. Get All Configurations
```
GET /config/all
```

**Description:** Retrieves all co-scholastic configurations sorted by class, section, and academic year.

## Available Activities

The system supports the following activity IDs:

| ID | Default Label | Description |
|----|---------------|-------------|
| `artEducation` | Art Education | Art and craft activities |
| `recitation` | Recitation / Rhymes | Poetry recitation and rhymes |
| `handwriting` | Handwriting | Handwriting assessment |
| `responsibility` | Responsibility | Responsibility assessment |
| `cleanliness` | Cleanliness | Cleanliness and hygiene |
| `punctuality` | Punctuality | Punctuality assessment |
| `discipline` | Discipline | Discipline assessment |
| `generalKnowledge` | General Knowledge | General knowledge assessment |
| `communication` | Communication Skill | Communication skills |

## Client-Side Integration

### Frontend Features

1. **Configuration Modal** (class-students.html):
   - Enable/disable activities with checkboxes
   - Customize activity labels
   - Save configuration to database

2. **Dynamic Marksheet** (skymarksheet.html):
   - Fetches configuration from database
   - Populates co-scholastic table dynamically
   - Only shows enabled activities
   - Uses custom labels from configuration

### JavaScript Functions

#### loadCoScholasticConfig()
```javascript
async function loadCoScholasticConfig() {
    // Fetches configuration from database
    // Falls back to defaults if none exists
    // Updates the co-scholastic table
}
```

#### updateCoScholasticTable()
```javascript
function updateCoScholasticTable() {
    // Clears existing table rows
    // Adds rows for enabled activities
    // Uses custom labels from configuration
}
```

## Usage Examples

### 1. Setting up Co-Scholastic for Class I-A

```javascript
// Client-side: Save configuration
const configData = {
    class: 'I',
    section: 'A',
    academicYear: '2024-2025',
    activities: [
        { id: 'artEducation', label: 'Art & Craft', enabled: true },
        { id: 'recitation', label: 'Poetry Recitation', enabled: true },
        { id: 'handwriting', label: 'Handwriting', enabled: true },
        { id: 'discipline', label: 'Class Discipline', enabled: true }
    ]
};

fetch('/api/coscholastic/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(configData)
});
```

### 2. Loading Configuration for Marksheet

```javascript
// Client-side: Load configuration
const response = await fetch('/api/coscholastic/config/I/A/2024-2025');
const config = await response.json();

// Update table with enabled activities
config.activities.forEach(activity => {
    if (activity.enabled) {
        addActivityToTable(activity.id, activity.label);
    }
});
```

## Database Operations

### Seed Script
Run the seed script to populate default configurations for existing classes:

```bash
cd Server
node seedCoScholasticConfig.js
```

### Test Script
Run the test script to verify API functionality:

```bash
cd Server
node testCoScholasticConfig.js
```

## Error Handling

The API provides comprehensive error handling:

- **400 Bad Request**: Invalid input data or missing required fields
- **404 Not Found**: Configuration not found (for non-existent routes)
- **500 Internal Server Error**: Database or server errors
- **11000 Duplicate Key**: Attempt to create duplicate configuration

## Security

- All endpoints require authentication via JWT token
- Input validation prevents malformed data
- MongoDB injection protection via Mongoose

## File Structure

```
Server/
├── models/
│   └── CoScholasticConfig.js     # Database model
├── routes/
│   └── coScholasticConfig.routes.js  # API routes
├── seedCoScholasticConfig.js     # Seed script
├── testCoScholasticConfig.js     # Test script
└── server.js                     # Main server file
```

## Integration with Exam Configuration

The Co-Scholastic system follows the same pattern as the Exam configuration system:

- Same URL structure: `/api/coscholastic/config/:className/:section/:academicYear`
- Same fallback mechanism: Returns default configuration if none exists
- Same save endpoint: `POST /config` with upsert functionality
- Consistent error handling and response format

## Future Enhancements

Potential improvements for the system:

1. **Activity Templates**: Pre-defined activity sets for different grade levels
2. **Bulk Operations**: Apply configuration to multiple classes at once
3. **Import/Export**: CSV or Excel import/export for configurations
4. **Activity Categories**: Group activities into categories (e.g., Sports, Arts, Personal Development)
5. **Grade Scales**: Customizable grade scales per activity
6. **Reporting**: Analytics and reporting on co-scholastic performance
