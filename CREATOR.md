# SPIKE Creator & Ownership Identity

**Project:** SPIKE Growth Intelligence  
**Tagline:** Turn Insight Into Growth. Your Next Move Starts Here.  
**Creator:** Evans Muyomba  
**Creator ID:** `evans-muyomba`  
**Primary contact:** adriensmith142@gmail.com  
**Backup contacts:** nsindisod04@gmail.com, nsindisod228@gmail.com

## How SPIKE is connected to its creator

SPIKE carries a stable creator identity in the application configuration and server API. The creator identity is included in SPIKE's internal AI context so the AI knows who created the software without confusing the creator with an individual business workspace owner.

The public creator identity endpoint is `/api/creator`.

## Important security note

Creator identity is an attribution/ownership marker, not authentication. It does not prove legal ownership by itself and should not be treated as a secret. If SPIKE is deployed publicly, add a proper authenticated owner/admin account before exposing private creator controls.


## v1.8 additions
- Customer Intelligence lead tracker with new/contacted/qualified/won/lost stages.
- Public opportunity results can be promoted into the local lead tracker for owner follow-up.
- Customer pipeline counts are calculated from recorded leads; SPIKE does not treat opportunities as confirmed customers.
- Growth, Action Board, feedback/Creator Console, AI research and subscription foundations remain preserved.
