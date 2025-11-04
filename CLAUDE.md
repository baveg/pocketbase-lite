# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

`pblite` (PocketBase Lite) is a lightweight TypeScript client library for PocketBase backend API. It provides a type-safe, reactive interface for collections, authentication, real-time subscriptions, and file management.

This library is part of the larger m4k_client monorepo and is referenced via path alias from the main application.

## Development Commands

This library is compiled via TypeScript and has no build step. Type checking is done at the monorepo level.

### Type Checking

- `npx tsc --noEmit` - Type check TypeScript without emitting files (run from library root)

The library uses strict TypeScript settings with comprehensive type checking enabled.

## Architecture

### Core Classes

#### PbClient (`src/PbClient.ts`)

Central client managing API connections, authentication, and server time synchronization.

**Key Features:**
- **API URL Management**: Configurable base URL with `setApiUrl()` and `getUrl()`
- **Authentication**: Token-based auth stored in reactive `auth$` flux with automatic header injection
- **Time Synchronization**: Automatic server time sync with `initTime()`, accessible via `getTime()` and `getDate()`
- **Request Management**: Unified `req()` method with authentication headers and error handling
- **Token Refresh**: `authRefresh()` for maintaining active sessions
- **Reactive State**: Uses fluxio's `flux()` and `fluxStored()` for reactive auth, URL, and error state

**Singleton Pattern:**
```typescript
export const getPbClient = () => pbClient || (pbClient = new PbClient());
```

#### PbColl (`src/PbColl.ts`)

Generic collection class for CRUD operations on PocketBase collections.

**Core Methods:**
- `get(id)` - Fetch single record by ID
- `page(where, page, perPage)` - Paginated query with filtering
- `filter(where)` - Filtered query without pagination
- `all(where)` - Fetch all matching records (up to 9999)
- `one(where)` - Fetch single record matching filter
- `findId(where)` - Get only the ID of matching record
- `count(where)` - Count records matching filter
- `create(data)` - Create new record
- `update(id, data)` - Update existing record
- `up(id, changes)` - Lightweight update returning only success boolean
- `delete(id)` - Delete record
- `upsert(where, changes)` - Update if exists, create if not

**File Operations:**
- `getFileUrl(id, filename, thumb?, download?, params?)` - Build file URL with optional thumbnail sizing
- `getDownloadUrl(id, filename, thumb?, params?)` - Build download URL
- `getFile(id, filename, ...)` - Download file as Blob

**Real-time Subscriptions:**
- `on(callback, topic?, options?)` - Subscribe to collection changes (creates, updates, deletes)

#### PbAuthColl (`src/PbAuthColl.ts`)

Extends `PbColl` with authentication-specific methods for user collections.

**Authentication Methods:**
- `signUp(email, password)` - Create new user account
- `login(identity, password)` - Authenticate user and set auth token
- `passwordReset(email)` - Request password reset email

#### PbRealtime (`src/PbRealtime.ts`)

Manages Server-Sent Events (SSE) connections for real-time updates.

**Key Features:**
- **Automatic Connection Management**: Connects when subscriptions exist, disconnects when none remain
- **Subscription Tracking**: Maintains subscriptions per collection/topic with automatic cleanup
- **Reconnection Logic**: Exponential backoff with automatic reconnection on connection loss
- **Heartbeat Monitoring**: Tracks connection health with 30-second timeout
- **EventSource Integration**: Uses native EventSource API with PB_CONNECT event handling
- **Listener Management**: Adds/removes event listeners dynamically based on active subscriptions

**Connection Lifecycle:**
1. `connect()` - Establishes EventSource connection, waits for PB_CONNECT
2. `update()` - Sends subscription list to server, manages connection state
3. `disconnect()` - Cleans up listeners and closes EventSource
4. `scheduleReconnect()` - Handles reconnection with delay

**Usage Pattern:**
```typescript
const unsubscribe = collection.on((record, action) => {
  console.log('Record:', record, 'Action:', action); // 'create' | 'update' | 'delete'
}, '*'); // topic: '*' for all records or specific record ID
```

### Type System (`src/types.ts`)

**Core Types:**
- `PbModel` - Base interface with id, created, updated fields
- `PbCreate<T>` - Omits generated fields for creation
- `PbUpdate<T>` - Partial type for updates
- `PbWhere<T>` - Type-safe filter conditions with operators
- `PbOptions<T>` - Query options (select, where, orderBy, expand, pagination)
- `PbPage<T>` - Paginated response with items and metadata
- `PbAuth` - Authentication state with token and user info
- `PbOperator` - Filter operators (=, !=, >, >=, <, <=, ~, !~, ?=, etc.)

**Filter System:**
- Supports all PocketBase operators including "any/at least one" variants (?=, ?!=, etc.)
- Type-safe field access via keyof T
- Supports single conditions or arrays of conditions
- Special handling for LIKE/Contains operators with wildcard wrapping

### Query Parameter Building (`src/pbParams.ts`)

Converts `PbOptions<T>` into PocketBase API query parameters:
- `orderBy` → `sort` (comma-separated)
- `select` → `fields` (comma-separated)
- `where` → `filter` (PocketBase filter syntax)
- Handles expand, pagination (page, perPage), and skipTotal flags

**Filter Formatting:**
- Converts typed where clauses to PocketBase filter strings
- Handles operators: `[">=", 10]` → `field >= 10`
- Quotes strings, formats dates via JSON.stringify
- Combines multiple conditions with `&&`

## Dependencies

**External:**
- `fluxio` - Reactive state management, utilities, and request handling

**Fluxio Integration:**
- Uses `flux()` and `fluxStored()` for reactive state
- Uses `req()` for HTTP requests with authentication
- Uses utility functions: `isDictionary`, `isString`, `isFloat`, `pathJoin`, `setUrlParams`, etc.
- Uses `logger()` for debug/info/warn/error logging

## Usage Patterns

### Basic Collection Usage

```typescript
import { PbClient, PbColl, PbAuthColl } from 'pblite';

// Initialize client
const client = new PbClient('myApp');
client.setApiUrl('https://api.example.com');

// Create collections
const userColl = new PbAuthColl<UserModel>('users', client);
const postColl = new PbColl<PostModel>('posts', client);

// Authenticate
await userColl.login('user@example.com', 'password');

// Query with type-safe filters
const posts = await postColl.all({
  author: userId,
  created: ['>=', new Date('2024-01-01')]
});

// Subscribe to real-time updates
const unsubscribe = postColl.on((post, action) => {
  console.log(`Post ${action}:`, post);
}, '*');
```

### File Management

```typescript
// Get file URL with thumbnail
const imageUrl = postColl.getFileUrl(post.id, post.image, 200); // 200x200 thumb

// Download file
const blob = await postColl.getFile(post.id, post.document);
```

### Time Synchronization

```typescript
// Get server time (automatically synced)
const serverTime = client.getTime(); // milliseconds
const serverDate = client.getDate(); // Date object

// Time offset is stored in client.offset$ flux
```

## Integration with Parent Project

This library is used in the main application via TypeScript path alias:

```typescript
// In parent tsconfig.json
"paths": {
  "fluxio": ["./fluxio/src/index"],
  "fluxio/*": ["./fluxio/src/*"]
}
```

The library provides the data layer for the main application's collection-based API system, with collections like `contentColl`, `deviceColl`, `mediaColl`, etc. extending `PbColl` and `PbAuthColl`.

## Development Guidelines

**Code Quality:**
- Follow strict TypeScript typing throughout
- Use generic types for collection methods to maintain type safety
- Never expose raw API responses; always type them as `T extends PbModel`
- Use the logger for all debug/info/warn/error messages

**Error Handling:**
- All async methods should catch and re-throw errors after logging
- Use `toError()` from fluxio to normalize error objects
- Client errors flow through `error$` flux for reactive error handling

**State Management:**
- Auth state is reactive via `auth$` flux with localStorage persistence
- URL changes trigger time synchronization via `initTime()`
- All fluxes use validators (isPbAuth, isString, isFloat) for type safety

**Real-time Subscriptions:**
- Subscriptions automatically manage EventSource lifecycle
- Connection state checked via `getIsConnected()` with heartbeat monitoring
- Reconnection logic handles network interruptions transparently
- Always return unsubscribe function for cleanup
