# Nomos Uploads Specification

**Status:** Draft
**Version:** 0.1.2
**Audience:** Platform contributors, plugin authors, admin‑UI implementers
**Scope:** Defines first‑class asset uploads in Nomos, including storage abstraction, API contracts, SDK exposure, admin‑UI integration, and observability requirements.
**Applies to:** nomos-core, nomos-api, nomos-sdk, nomos-ui, storage plugins

---

## 1. Overview

Uploads in Nomos are modeled as first‑class **Assets** with a minimal, stable metadata contract and a pluggable storage backend. The system is designed to:

* Support **signed‑URL based uploads** as the primary mechanism
* Work with **local filesystem storage** and **S3‑compatible object storage** using the same API
* Expose uploads through the **Nomos API and SDK**, not via direct platform internals
* Remain **plugin‑extensible** for storage drivers, scanning, or transformations
* Provide **lightweight admin‑UI support** without complex media tooling

This specification defines v1 behavior. Advanced concerns (variants, transformations, galleries, multi‑tenancy) are explicitly deferred.

---

## 2. Non‑Goals (v1)

The following are intentionally out of scope for this specification:

* Image or file variants (resizing, thumbnails, transformations)
* Media galleries or asset libraries
* Client‑side editing or cropping tools
* Multipart / chunked uploads
* Multi‑tenant isolation
* Mandatory malware scanning
* Custom per‑asset metadata beyond the defined Asset schema

These concerns may be addressed by future specs or optional plugins.

---

## 3. Core Concepts

### 3.1 Asset

An **Asset** is a metadata record representing an uploaded file. The Asset record is persisted in the Nomos database (SQLite in v1) and references externally stored bytes.

**Asset fields (v1):**

* `id` – unique identifier
* `filename` – sanitized original filename
* `mime` – detected MIME type
* `size` – file size in bytes
* `sha256` – optional content hash (if provided or computed)
* `storageDriver` – identifier of the storage backend
* `storageKey` – opaque key/path used by the driver
* `visibility` – `public | private`
* `status` – `pending | ready | failed`
* `createdAt`
* `updatedAt`
* `deletedAt` (nullable)

No additional custom metadata is supported in v1.

---

### 3.2 Storage Drivers

A **Storage Driver** is a server‑side Nomos plugin that implements a common interface for storing and retrieving asset bytes.

Examples:

* Local filesystem driver
* S3‑compatible driver (AWS S3, DigitalOcean Spaces, etc.)

Nomos Core does not assume any specific storage implementation; all byte handling is delegated to drivers.

---

### 3.3 Signed URLs (Primary Upload Mechanism)

All uploads use **signed URLs**. A signed URL may point to:

* A Nomos endpoint (local storage driver), or
* An external object storage endpoint (S3‑compatible driver)

From the client’s perspective, both are treated identically.

---

## 4. Upload Lifecycle

### 4.1 Initiate Upload

Clients request permission to upload a new Asset.

**Result:**

* Asset record created in `pending` state
* Upload constraints returned
* Signed upload URL returned

**Returned data includes:**

* `assetId`
* `uploadUrl`
* required headers or form fields
* constraints (max size, allowed MIME types)

---

### 4.2 Transfer

The client uploads the file bytes directly to the signed URL using HTTP PUT or POST, as dictated by the driver.

Nomos does not proxy bytes unless the active storage driver requires it.

---

### 4.3 Finalize Upload

After transfer completes, the client finalizes the upload.

Nomos verifies:

* the storage object exists
* size constraints are satisfied
* optional hash matches (if provided)

The Asset status transitions to `ready` or `failed`.

---

## 5. Asset Visibility & Serving

Assets support two visibility modes:

* **Public** – retrievable via a stable URL
* **Private** – retrievable only via authenticated access or signed download URLs

### Serving Rules

* Local drivers may serve public assets via controlled static routes
* Private assets must be served via controller or short‑lived signed URLs
* S3 drivers may use bucket policies or presigned GET URLs

Visibility behavior is enforced by Nomos, not by client convention.

---

## 6. API Surface (Conceptual)

Nomos exposes assets via explicit API routes and mirrors them in the SDK.

### Required Operations

* `initiateUpload()`
* `finalizeUpload(assetId)`
* `getAsset(assetId)`
* `listAssets()`
* `deleteAsset(assetId)`
* `getDownloadUrl(assetId)` (optional helper)

Capabilities must be discoverable so SDK consumers can degrade gracefully when uploads are unavailable.

---

## 7. SDK Integration

Uploads are accessed **exclusively through the Nomos SDK** by:

* Plugins
* Applications
* Admin UI

SDK responsibilities:

* Abstract API routes
* Surface upload capabilities
* Hide storage‑specific details
* Fail gracefully when upload support is disabled

No SDK consumer directly interacts with storage drivers.

---

## 8. Admin UI Integration

Nomos provides a lightweight upload field component for panel modules.

### Upload Field Behavior

* Field‑name keyed
* Supports single or multiple assets
* Allows upload, replace, and remove
* Displays filename, size, status, and visibility
* Optionally previews images

### Explicitly Excluded

* Galleries or asset browsing
* Editing or cropping tools
* Variant management

The goal is minimal UI surface with maximum extensibility by downstream developers.

---

## 9. Observability Requirements

Uploads must emit structured events compatible with the Nomos observability system.

### Required Events

* `UPLOAD_INIT`
* `UPLOAD_TRANSFER`
* `UPLOAD_FINALIZED`
* `UPLOAD_FAILED`

Each event must include:

* request / correlation id
* actor (user or system)
* asset id
* storage driver
* byte counts and duration where applicable

---

## 10. Security & Validation

Nomos must enforce:

* Maximum file size limits
* Allowed MIME type lists
* Filename sanitization
* Storage isolation per driver

Content hashing (`sha256`) is optional in v1.

---

## 11. Testing Expectations

Although testing infrastructure may not yet be fully implemented, this feature **must be testable**.

The following coverage is expected:

* Storage driver contract tests
* API route authorization tests
* Upload lifecycle state transition tests
* Observability event emission tests

Test structure should mirror application structure per Nomos testing specifications.

---

## 12. Future Considerations

The following may be addressed in future specifications:

* Variant and transformation pipelines
* Media galleries
* Malware scanning hooks
* Multipart uploads
* Multi‑tenant isolation
* Asset retention policies

These features must not be assumed by v1 implementations.

---

**End of Specification**
