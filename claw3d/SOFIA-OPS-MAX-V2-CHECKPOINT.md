# Sofia Ops MAX v2 — checkpoint

Date: 2026-10-02

## Scope
Only Railway project `openclaw-sofia-ops` is in scope. Do not modify `zooming-sparkle`.

## Active routing
- Public entry: `sofia-claw3d-login-production.up.railway.app`
- Login/proxy service: `sofia-claw3d-login`
- Current upstream: `sofia-claw3d-next.railway.internal:3000`
- New active candidate service: `sofia-claw3d-next`
- Previous rollback service: `sofia-claw3d-building`
- Older rollback service: `sofia-claw3d-live`

## Versioned source
- Repository: `welvinsonkaiquealves-stack/Melly`
- Branch: `sofia-claw3d-max-v2`
- Base patch: `claw3d/patch-building-v1.js`
- MAX patch: `claw3d/patch-ops-v2.js`
- Pinned rollout commit: `386962be280b6d269bbc656a8139c02564fcc249`

## Implemented and enabled
- Existing 1st floor storage namespace retained.
- 2nd floor Audit Lab retained.
- 3rd floor Development & QA.
- 4th floor Infrastructure.
- 5th floor Intelligence & Analytics.
- 6th floor Command Center.
- Shared OpenClaw runtime across Sofia floors.
- In-memory Sofia Ops Event Fabric (240-event ring buffer).
- Runtime Gateway events bridged into Digital Twin event stream.
- Sofia Ops HUD with Digital Twin status, Shadow Twin armed state, War Room incident detection and RAM replay counter.
- WebGL stability layer: stable Canvas key, Canvas kept mounted under immersive overlays, mobile DPR cap, lower shadow-map budget, context-loss/restoration hooks, touch dolly/pan controls.
- Existing mobile zoom patch (18–200) retained.

## Prepared but intentionally not consuming expensive infrastructure
- Deep persistent replay/history: OFF, architecture prepared.
- GPU generation fabric: OFF, architecture prepared.
- Multi-project fabric: capability prepared, external projects not yet attached.
- Shadow Twin: visual/event architecture armed; real clinic WhatsApp shadow events require later project integration.
- War Room: runtime error detection active; automated cross-service incident feeds require later integrations.

## Validation completed
- Isolated v1+v2 staging deployment: SUCCESS.
- Candidate with real Railway variable references, access gate and health patch: SUCCESS.
- `/healthz` Railway healthcheck: passing.
- Login/proxy redeployed and confirmed pointing to `sofia-claw3d-next`: SUCCESS.
- `sofia-claw3d-building` remains intact for immediate rollback.
- `sofia-claw3d-live` remains intact as older rollback.

## Rollback
Set `sofia-claw3d-login` variable `UPSTREAM_HOST` back to `sofia-claw3d-building.railway.internal` and `UPSTREAM_PORT=3000`. No code rollback is required.

## Pause rule
If work is interrupted, do not delete or overwrite `sofia-claw3d-next`, `sofia-claw3d-building`, or `sofia-claw3d-live`. Resume from this checkpoint and revalidate Railway status before further modifications.
