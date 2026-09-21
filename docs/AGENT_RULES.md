# Agent rules

Never change the game engine.
Never replace Babylon.js.
Never introduce React, Vue or Angular.
Never add dependencies without a justified reason.
Prefer existing Babylon features over third-party libraries.
Every gameplay system must have tests.
Every important user journey must have an E2E test.
Never commit broken TypeScript.
Never ignore TypeScript errors.
Never disable failing tests just to pass CI.
Never use `any` without explicit justification.
Every enemy must be data-driven.
Every zone must support unloading.
Every asset must pass validation.
Target stable 60 FPS.
WebGPU first.
WebGL2 fallback.
Never put gameplay logic in rendering components.
Never hardcode story progression inside scenes.
Save compatibility must be preserved.
Always clean resources when unloading scenes.
Never silently swallow runtime errors.
Do not prematurely optimize code without measurement.
Performance regressions must be measured.

Read documentation, inspect Git, implement, typecheck, test, build, functionally test, measure if needed, update docs, commit atomically. No restart or rewrite by preference. Original content only. TODO_ART for placeholders. Report measured results and real limitations.
