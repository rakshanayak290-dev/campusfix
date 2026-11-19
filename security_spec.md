# CampusFix Security Specification (Phase 0)

## 1. Data Invariants
1. **Identity Integrity**: A `User` document at `/users/{userId}` can only be created when `uid == request.auth.uid` and `userId == request.auth.uid`. Students can never self-assign `role: "admin"` unless verified as the bootstrapped admin email (`rakshanayak290@gmail.com` with `email_verified == true`).
2. **PII Isolation**: User documents contain `email` and `studentId` and are strictly readable only by the owning user or an authenticated administrator (`/admins/{uid}`).
3. **Complaint Ownership & State Machine**: A `Complaint` document can only be created by a verified authenticated user with `studentUid == request.auth.uid`, initial `status == "Submitted"`, and `adminRemarks == ""`. Students cannot modify `status`, `adminRemarks`, `studentUid`, `complaintId`, or `createdAt` after creation. Only administrators can transition `status` (`Submitted -> Under Review -> In Progress -> Resolved`) and update `adminRemarks`.
4. **Temporal Integrity**: `createdAt` must equal `request.time` on creation and remain immutable. `updatedAt` must equal `request.time` on creation and every update.
5. **Notification Scoping**: Students can only read and mark-read notifications where `recipientUid == request.auth.uid`. Admins can read and mark-read admin-broadcast notifications (`recipientRole == "admin"`).
6. **Public Aggregates & 500-Member Cohort Shards**: `/public_stats/campus` and `/public_stats_shards/shard_0..shard_19` contain only non-negative integer counters (`totalReported`, `totalResolved`, `activeRequests`, `registeredStudents` capped at `<= 500`) with zero PII, preventing transaction contention across 500 simultaneous student registrations and complaint submissions.
7. **Complaint Cohort Impact Bounds**: Optional `affectedStudentsCount` on complaints is constrained to `1..500` integers and `affectedUsnRange` is capped at `80` characters.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Self-Assigned Admin Privilege Escalation**: Student registers `/users/{uid}` with `role: "admin"`. Expected: `PERMISSION_DENIED`.
2. **Student Role Mutation**: Student updates `/users/{uid}` changing `role` from `"student"` to `"admin"`. Expected: `PERMISSION_DENIED`.
3. **Shadow Field Injection on User**: Student creates `/users/{uid}` with extra ghost field `isVerified: true`. Expected: `PERMISSION_DENIED`.
4. **Cross-User PII Read**: Student A attempts `get` on `/users/{studentB_uid}`. Expected: `PERMISSION_DENIED`.
5. **Complaint Identity Spoofing**: Student A creates `/complaints/CMP-2026-9999` with `studentUid: "student_b_uid"`. Expected: `PERMISSION_DENIED`.
6. **Complaint Status Pre-Approval**: Student creates `/complaints/CMP-2026-9998` with initial `status: "Resolved"`. Expected: `PERMISSION_DENIED`.
7. **Student Status Tampering**: Student updates their own complaint to set `status: "Resolved"` or `adminRemarks: "Approved"`. Expected: `PERMISSION_DENIED`.
8. **Cross-Student Complaint Read**: Student A attempts `get` on Student B's complaint document. Expected: `PERMISSION_DENIED`.
9. **Path ID Poisoning**: Attacker creates `/complaints/invalid$id!with*spaces` or a 500-char ID. Expected: `PERMISSION_DENIED`.
10. **Client Timestamp Forgery**: Student creates complaint with `createdAt` set to a past client date instead of `serverTimestamp()`. Expected: `PERMISSION_DENIED`.
11. **Oversized Payload Denial-of-Wallet**: Attacker submits complaint `description` > 2000 chars or `history` array > 20 entries. Expected: `PERMISSION_DENIED`.
12. **Unverified Admin Email Spoof**: User with unverified email token (`email_verified: false`) attempts to bootstrap `/admins/{uid}` or read all complaints. Expected: `PERMISSION_DENIED`.
