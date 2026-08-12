# The Journey to My Princess — Build Notes

This bundle contains the current playable prototype plus the four supplied character reference images.

## Character references
- assets/references/knight-reference.png
- assets/references/bear-reference.png
- assets/references/teacher-reference.png
- assets/references/princess-reference.png

Use these as the visual references for the four major characters. Do not replace them with emoji, CSS shapes, or unrelated artwork.

## Important requirements for the next version

1. Keep the game portrait-oriented on phones.
2. Main game/story area is the upper section.
3. Lower section is a clean black control area containing only:
   LEFT, RIGHT, JUMP, ACT.
4. Every touch button must be large and pressable.
5. Story/menu CONTINUE must have its own safe area and must never be hidden behind gameplay controls.
6. Prevent page scrolling during gameplay.
7. Preserve aspect ratio. Never stretch the game or character sprites.
8. Add a visible FULL SCREEN option using the browser Fullscreen API.
9. Fullscreen must preserve the portrait game presentation and remain usable on Android.
10. Keep desktop as a centered portrait game with black side margins.
11. Use local assets; do not depend on external image URLs or a backend.
12. Save progress with localStorage.
13. Three arcs: Winter / First Snow, Spring, Ruined School.
14. Ten collectibles per arc.
15. Two checkpoints per arc.
16. Short-range sword attack.
17. Bear boss and Teacher Monster boss use the supplied references.
18. Minor characters/environmental sprites can be created in matching pixel-art style.
19. The Princess must be visibly present at the ending.
20. Final reunion must be animated: knight approaches Princess, Princess reacts/turns, they approach, hold hands, then a heart/love effect appears above them.
21. After the reunion, show:
   "Our beautiful life together is only beginning."
22. Keep the final message in one easy-to-edit configuration value.
23. START = new game; confirm before overwriting an existing save.
24. CONTINUE = latest saved arc/checkpoint.
25. RESET/NEW GAME = clear save after confirmation.
26. After the completed ending, CONTINUE returns to the title screen with completion saved.
27. Test portrait Android, fullscreen Android, desktop, save/continue/reset, touch controls, collectibles, checkpoints, boss unlocking, bosses, and final reunion before publishing.

The current code is only the starting prototype. The next build should improve it rather than replacing the concept with an unrelated project.
