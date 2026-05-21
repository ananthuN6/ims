# 🛡️ IMS – Incident Management System v2

Full-stack incident management system with **Microsoft Single Sign-On**, **Outlook email via Microsoft Graph**, file-based JSON database (MSSQL-ready), and role-based access control.

---

## Architecture

```
ims-v2/
├── config/
│   └── config.js          ← ALL credentials live here
├── backend/               ← Express.js API server
│   ├── db/
│   │   ├── fileDb.js      ← File-based DB layer (swap for MSSQL here)
│   │   ├── users.json     ← auto-created on first run
│   │   ├── incidents.json ← auto-created on first run
│   │   └── emailLog.json  ← auto-created on first run
│   ├── routes/
│   │   ├── auth.js        ← MS token verification → IMS user session
│   │   ├── users.js       ← Admin CRUD for users
│   │   └── incidents.js   ← Full incident lifecycle API
│   ├── services/
│   │   └── emailService.js← Microsoft Graph sendMail
│   └── server.js
└── frontend/              ← React app (MSAL login, API calls)
    └── src/
        ├── auth/msalConfig.js
        ├── config.js      ← Azure client ID + tenant ID
        ├── pages/         ← Login, Dashboard, Incidents, Admin…
        └── …
```

---

## Step 1 – Register an App in Azure AD

> You need an Azure account with permission to register apps in your tenant.

1. Go to **[portal.azure.com](https://portal.azure.com)** → **Azure Active Directory** → **App registrations** → **New registration**

2. Fill in:
   - **Name:** `IMS – Incident Management System`
   - **Supported account types:** *Accounts in this organizational directory only (Single tenant)*
   - **Redirect URI:** Select **Single-page application (SPA)** → enter `http://localhost:3000`

3. Click **Register**. Note down:
   - **Application (client) ID** → `config.azure.clientId` and `frontend/src/config.js → AZURE.clientId`
   - **Directory (tenant) ID** → `config.azure.tenantId` and `frontend/src/config.js → AZURE.tenantId`

4. Go to **Certificates & secrets** → **New client secret** → set an expiry → **Add**  
   Copy the **Value** immediately → `config.azure.clientSecret`

5. Go to **API permissions** → **Add a permission** → **Microsoft Graph** → **Application permissions**  
   Add: `Mail.Send`  
   Then click **Grant admin consent for [your org]** ✅

6. Go to **API permissions** → **Add a permission** → **Microsoft Graph** → **Delegated permissions**  
   Add: `User.Read`, `openid`, `profile`, `email`

> **Summary of required permissions:**
> | Type | Permission | Purpose |
> |---|---|---|
> | Delegated | `User.Read` | Read logged-in user profile |
> | Delegated | `openid`, `profile`, `email` | MSAL login |
> | Application | `Mail.Send` | Send emails from IMS mailbox |

---

## Step 2 – Configure the IMS Sender Mailbox

The IMS sender mailbox is a **dedicated Outlook/Exchange mailbox** in your tenant that sends all automated emails (e.g. `ims-noreply@yourcompany.com`).

1. Create (or use an existing) mailbox in your Microsoft 365 admin centre
2. The app registration must have **Mail.Send** application permission (done above)
3. This email goes in `config.azure.senderEmail`

---

## Step 3 – Fill in config/config.js

```js
// config/config.js

module.exports = {
  server: {
    port: 4000,
    frontendUrl: 'http://localhost:3000',   // change in production
  },

  azure: {
    tenantId:     'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',   // ← from Step 1
    clientId:     'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',   // ← from Step 1
    clientSecret: 'your~client~secret~value',               // ← from Step 1
    senderEmail:  'ims-noreply@yourcompany.com',             // ← dedicated IMS mailbox
  },

  admin: {
    // The Microsoft account (UPN) of the one admin ISO user.
    // On first login this person is auto-created in the DB with isAdmin: true.
    email: 'admin.iso@yourcompany.com',
    name:  'Admin ISO',
  },

  db: {
    dir:       './db',
    users:     './db/users.json',
    incidents: './db/incidents.json',
    emailLog:  './db/emailLog.json',
  },
};
```

---

## Step 4 – Fill in frontend/src/config.js

```js
// frontend/src/config.js

export const AZURE = {
  clientId:    'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',  // same as config.azure.clientId
  tenantId:    'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',  // same as config.azure.tenantId
  redirectUri: 'http://localhost:3000',
};

export const API_BASE = '/api';   // proxied to backend in dev; set full URL in prod
```

---

## Step 5 – Install & Run

### Prerequisites
- **Node.js** ≥ 18  
- **npm** ≥ 9

### Backend

```bash
cd ims-v2/backend
npm install
npm start
# → http://localhost:4000
```

The DB JSON files are created automatically on first run inside `backend/db/`.

### Frontend

```bash
cd ims-v2/frontend
npm install
npm start
# → http://localhost:3000
```

---

## Step 6 – First Login (Admin Setup)

1. Open `http://localhost:3000`
2. Click **Continue with Microsoft** and sign in with the email you put in `config.admin.email`
3. The admin account is **auto-created** in the DB on first login
4. Navigate to **User Admin** (⭐ icon in sidebar)
5. Add all users who need IMS access: enter their **name**, **organisation email** (must match their Microsoft 365 UPN), and **role**

> 💡 Users with an email not in the DB will get an "Access denied" message when they try to log in via Microsoft SSO.

---

## Roles

| Role | What they can do |
|---|---|
| **Employee** | Submit incidents · View own incidents · Submit closure details when assigned as owner |
| **ISO Team** | View ALL incidents · Validate/assign/reject incidents · Close incidents · Export Excel · View email log |
| **Admin ISO** | Everything ISO can do + add/edit/delete users in User Admin |

> ISO Team can also submit incidents and be assigned as owner — they have full access to all roles' functionality.

---

## Incident Workflow

```
[Employee]        [ISO Team]         [Owner]
Submit            Validate
Incident   ────►  & Assign   ─────►  Submit RCA
                  or Reject          & Closure
                     │                  │
                     ▼                  ▼
                  [Rejected]        [ISO Final
                                     Closure]
                                    (with Lessons
                                     Learned)
```

### Status flow
`Submitted` → `Assigned` or `Rejected` → `Pending ISO Closure` → `Closed`

### Who gets emailed
| Event | Recipients | Via |
|---|---|---|
| Incident submitted | All ISO Team | Outlook (Graph) |
| Validated & assigned | Assigned owner | Outlook (Graph) |
| Rejected | Reporter | Outlook (Graph) |
| Closure details submitted | All ISO Team | Outlook (Graph) |
| Incident closed | Reporter + Owner | Outlook (Graph) |

---

## Production Deployment

### Backend
```bash
# Set NODE_ENV and update config frontendUrl to your domain
NODE_ENV=production node server.js
```

Use a process manager like **PM2**:
```bash
npm install -g pm2
pm2 start server.js --name ims-backend
pm2 save
```

### Frontend
```bash
cd frontend
npm run build
# Deploy the build/ folder to Nginx, Vercel, Azure Static Web Apps, etc.
```

Update `frontend/src/config.js`:
```js
export const API_BASE = 'https://your-api-domain.com/api';
```

Update `config/config.js`:
```js
frontendUrl: 'https://your-frontend-domain.com'
```

In **Azure App Registration → Authentication**, add your production redirect URI:
```
https://your-frontend-domain.com
```

---

## Migrating to MSSQL

All DB logic is isolated in `backend/db/fileDb.js`. To migrate:

1. Install `mssql`: `npm install mssql`
2. Replace each method in `fileDb.js` with a Sequelize or raw `mssql` query
3. The schema maps directly:

```sql
-- Users
CREATE TABLE Users (
  id          NVARCHAR(36) PRIMARY KEY,
  name        NVARCHAR(200) NOT NULL,
  email       NVARCHAR(200) NOT NULL UNIQUE,
  role        NVARCHAR(20) NOT NULL CHECK (role IN ('employee','iso')),
  isAdmin     BIT DEFAULT 0,
  createdAt   DATETIME2 DEFAULT GETDATE()
);

-- Incidents
CREATE TABLE Incidents (
  id                 NVARCHAR(36) PRIMARY KEY,
  incidentId         NVARCHAR(20) NOT NULL,
  description        NVARCHAR(MAX),
  incidentDate       DATE,
  reportedBy         NVARCHAR(36),
  reportedByName     NVARCHAR(200),
  attachments        NVARCHAR(MAX),   -- JSON stringified
  status             NVARCHAR(50),
  validationStatus   NVARCHAR(20),
  severity           NVARCHAR(20),
  ownerId            NVARCHAR(36),
  ownerName          NVARCHAR(200),
  isoComments        NVARCHAR(MAX),
  rca                NVARCHAR(MAX),
  correction         NVARCHAR(MAX),
  correctiveAction   NVARCHAR(MAX),
  targetDate         DATE,
  closureAttachments NVARCHAR(MAX),   -- JSON stringified
  lessonsLearned     NVARCHAR(MAX),
  closedDate         DATE,
  reviewDate         DATE,
  reviewedBy         NVARCHAR(200),
  createdAt          DATETIME2 DEFAULT GETDATE(),
  updatedAt          DATETIME2 DEFAULT GETDATE()
);

-- EmailLog
CREATE TABLE EmailLog (
  id        NVARCHAR(36) PRIMARY KEY,
  [to]      NVARCHAR(500),
  subject   NVARCHAR(500),
  [type]    NVARCHAR(50),
  status    NVARCHAR(20),
  [error]   NVARCHAR(MAX),
  timestamp DATETIME2 DEFAULT GETDATE()
);
```

---

## Troubleshooting

| Problem | Fix |
|---|---|
| Login popup blocked | Allow popups for `localhost:3000` in your browser |
| "Access denied" on login | The logged-in MS account email isn't in the users DB. Log in as admin and add them. |
| Emails not sending | Check `backend/db/emailLog.json` for `status: "failed"` entries with error details. Verify Mail.Send permission has admin consent in Azure. |
| CORS errors | Ensure `config.server.frontendUrl` exactly matches `http://localhost:3000` (no trailing slash) |
| Graph 403 on sendMail | The app permission `Mail.Send` needs **admin consent** granted in Azure Portal → API permissions |
| `invalid_client` MSAL error | Double-check `clientId`, `tenantId`, `clientSecret` in both config files |
