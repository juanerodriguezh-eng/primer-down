# Tipos de jugada en los datos reales de ESPN

Generado por `herramientas/listar-tipos.mjs`. No editar a mano la parte de las tablas: se regenera.

- **Partidos analizados:** 137 (temporada 2026, semanas 1 a 10). De ellos, 16 están guardados completos en `datos/crudos/` y el resto en formato compacto (solo jugadas) en `datos/corpus/`.
- **Jugadas analizadas:** 25.387.
- **Tipos distintos (`type.text`):** 32.

## Resumen

| # | `type.text` | id | abrev. | Veces | En los 16 completos |
| --- | --- | --- | --- | ---: | ---: |
| 1 | **Rush** | 5 | RUSH | 7043 | 836 |
| 2 | **Pass Reception** | 24 | REC | 5318 | 588 |
| 3 | **Pass Incompletion** | 3 | (vacía) | 3072 | 346 |
| 4 | **Official Timeout** | 74 | Off TO | 1929 | 227 |
| 5 | **Kickoff** | 53 | K | 1412 | 168 |
| 6 | **Penalty** | 8 | PEN | 1397 | 182 |
| 7 | **Timeout** | 21 | TO | 1039 | 121 |
| 8 | **Punt** | 52 | PUNT | 1028 | 126 |
| 9 | **Sack** | 7 | (vacía) | 580 | 78 |
| 10 | **Field Goal Good** | 59 | FG | 487 | 65 |
| 11 | **Passing Touchdown** | 67 | TD | 414 | 45 |
| 12 | **Two-minute warning** | 75 | 2Min Warn | 278 | 33 |
| 13 | **End Period** | 2 | EP | 275 | 32 |
| 14 | **Rushing Touchdown** | 68 | TD | 259 | 27 |
| 15 | **Pass Interception Return** | 26 | INTR | 190 | 28 |
| 16 | **End of Half** | 65 | EH | 138 | 16 |
| 17 | **End of Game** | 66 | EG | 137 | 16 |
| 18 | **Fumble Recovery (Own)** | 9 | (vacía) | 128 | 16 |
| 19 | **Fumble Recovery (Opponent)** | 29 | (vacía) | 93 | 16 |
| 20 | **Field Goal Missed** | 60 | FGM | 80 | 8 |
| 21 | **Sack Opp Fumble Recovery** | 80 | SFOP | 40 | 5 |
| 22 | **End of Regulation** | 79 | ER | 12 | 1 |
| 23 | **Blocked Field Goal** | 18 | BFG | 10 | 0 |
| 24 | **Muffed Punt Recovery (Opponent)** | 30 | (vacía) | 8 | 1 |
| 25 | **Interception Return Touchdown** | 36 | TD | 8 | 1 |
| 26 | **Fumble Return Touchdown** | 39 | TD | 4 | 0 |
| 27 | **Safety** | 20 | SF | 2 | 0 |
| 28 | **Kickoff Return Touchdown** | 32 | TD | 2 | 0 |
| 29 | **Blocked Punt** | 17 | BP | 1 | 0 |
| 30 | **Punt Return Touchdown** | 34 | TD | 1 | 0 |
| 31 | **Blocked Punt Touchdown** | 37 | TD | 1 | 0 |
| 32 | **Defensive 2pt Conversion** | 57 | D2P | 1 | 0 |

## Un ejemplo real de cada tipo

### Rush (7043)
- `B.Tuten right tackle to BLT 17 for 4 yards (T.Simpson).`  
  _BAL vs JAX, 1st & 10 at BAL 21_
- `C.Rodriguez right tackle to BLT 1 for no gain (R.Smith).`  
  _BAL vs JAX, 2nd & Goal at BAL 1_

### Pass Reception (5318)
- `(Shotgun) T.Lawrence pass short right to T.Koziol to JAX 27 for 4 yards (T.Simpson).`  
  _BAL vs JAX, 1st & 10 at JAX 23_
- `T.Lawrence pass deep right to N.Boerkircher to BLT 21 for 52 yards (M.Humphrey).`  
  _BAL vs JAX, 2nd & 6 at JAX 27_

### Pass Incompletion (3072)
- `(Shotgun) W.Milum reported in as eligible. T.Lawrence pass incomplete short right to N.Boerkircher.`  
  _BAL vs JAX, 1st & Goal at BAL 1_
- `(Shotgun) T.Lawrence pass incomplete short left to P.Washington.`  
  _BAL vs JAX, 3rd & 4 at BAL 42_

### Official Timeout (1929)
- `Official Timeout at 11:20.`  
  _BAL vs JAX, & Goal at JAX 35_
- `Official Timeout at 06:31.`  
  _BAL vs JAX, & Goal at BAL 35_

### Kickoff (1412)
- `J.Moody kicks 65 yards from BLT 35 to JAX 0. J.Cameron pushed ob at JAX 23 for 23 yards (J.Higgins).`  
  _BAL vs JAX_
- `C.Little kicks 62 yards from JAX 35 to BLT 3. R.Ali to BLT 35 for 32 yards (Q.Morris).`  
  _BAL vs JAX_

### Penalty (1397)
- `(Shotgun) PENALTY on BLT-N.Madubuike, Neutral Zone Infraction, 5 yards, enforced at BLT 42 - No Play.`  
  _BAL vs JAX, 4th & 4 at BAL 42_
- `(Shotgun) PENALTY on BLT-R.Stanley, False Start, 5 yards, enforced at BLT 49 - No Play.`  
  _BAL vs JAX, 2nd & 5 at BAL 49_

### Timeout (1039)
- `Timeout #1 by BLT at 04:37.`  
  _BAL vs JAX, 4th & 1 at BAL 29_
- `Timeout #1 by JAX at 00:22.`  
  _BAL vs JAX, 4th & 2 at BAL 39_

### Punt (1028)
- `R.Eckley punts 53 yards to JAX 4, impetus ends at JAX 3, Center-N.Moore, downed by BLT-R.Ali.`  
  _BAL vs JAX, 4th & 11 at BAL 43_
- `L.Cooke punts 56 yards to BLT 20, Center-R.Matiscik, fair catch by L.Wester.`  
  _BAL vs JAX, 4th & 7 at JAX 24_

### Sack (580)
- `(Shotgun) J.Fagnano sacked at BLT 43 for -2 yards (F.Oluokun).`  
  _BAL vs JAX, 3rd & 9 at BAL 45_
- `(Shotgun) J.Burrow sacked at CIN 31 for -6 yards (L.London).`  
  _ATL vs CIN, 3rd & 1 at CIN 37_

### Field Goal Good (487)
- `J.Moody 53 yard field goal is GOOD, Center-N.Moore, Holder-R.Eckley.`  
  _BAL vs JAX, 4th & 6 at JAX 35_
- `C.Little 36 yard field goal is GOOD, Center-R.Matiscik, Holder-L.Cooke.`  
  _BAL vs JAX, 4th & 7 at BAL 18_

### Passing Touchdown (414)
- `(No Huddle, Shotgun) T.Lawrence pass deep left to P.Washington for 50 yards, TOUCHDOWN. C.Little extra point is GOOD, Center-R.Matiscik, Holder-L.Cooke.`  
  _BAL vs JAX, 2nd & 8 at 50_
- `C.Levin and K.Hinton reported in as eligible. M.Penix pass short right to C.Woerner for 1 yard, TOUCHDOWN. N.Folk extra point is GOOD, Center-L.McCullough, Holder-J.Bailey.`  
  _ATL vs CIN, 1st & Goal at CIN 1_

### Two-minute warning (278)
- `Two-Minute Warning`  
  _BAL vs JAX, 1st & 10 at JAX 38_

### End Period (275)
- `END QUARTER 1`  
  _BAL vs JAX_
- `END QUARTER 3`  
  _BAL vs JAX_

### Rushing Touchdown (259)
- `B.Tuten left guard for 1 yard, TOUCHDOWN. C.Little extra point is GOOD, Center-R.Matiscik, Holder-L.Cooke.`  
  _BAL vs JAX, 3rd & Goal at BAL 1_
- `(Shotgun) W.Milum reported in as eligible. Direct snap to C.Rodriguez. C.Rodriguez right guard for 2 yards, TOUCHDOWN. C.Little extra point is GOOD, Center-R.Matiscik, Holder-L.Cooke.`  
  _BAL vs JAX, 1st & Goal at BAL 2_

### Pass Interception Return (190)
- `(Shotgun) J.Fagnano pass short left intended for Z.Flowers INTERCEPTED by M.Brown at BLT 32. M.Brown to BLT 26 for 6 yards (J.Hill).`  
  _BAL vs JAX, 3rd & 14 at BAL 25_
- `(Shotgun) J.Fagnano pass short left intended for Z.Flowers INTERCEPTED by J.Lewis at BLT 27. J.Lewis to BLT 23 for 4 yards (Z.Flowers).`  
  _BAL vs JAX, 1st & 10 at BAL 29_

### End of Half (138)
- `END QUARTER 2`  
  _BAL vs JAX_
- `END QUARTER 1`  
  _LAR vs ARI_

### End of Game (137)
- `END GAME`  
  _BAL vs JAX_

### Fumble Recovery (Own) (128)
- `J.Fagnano FUMBLES (Aborted) at JAX 46, and recovers at JAX 47. J.Fagnano to JAX 45 for 2 yards (V.Miller).`  
  _BAL vs JAX, 2nd & 5 at JAX 45_
- `M.Andrews FUMBLES (Aborted) at JAX 41, and recovers at JAX 41.`  
  _BAL vs JAX, 4th & 1 at JAX 41_

### Fumble Recovery (Opponent) (93)
- `(Shotgun) T.Lawrence pass short left to T.Hunter to JAX 48 for -3 yards (M.Starks). FUMBLES (M.Starks), RECOVERED by BLT-T.Buchanan at 50.`  
  _BAL vs JAX, 2nd & 1 at BAL 49_
- `(Shotgun) T.Shough pass short left to J.Tyson to CLV 2 for 9 yards (C.Schwesinger; Q.Williams). FUMBLES (C.Schwesinger), RECOVERED by CLV-T.Campbell at CLV 1.`  
  _NO vs CLE, 2nd & 10 at CLE 11_

### Field Goal Missed (80)
- `N.Folk 38 yard field goal is No Good, Wide Left, Center-L.McCullough, Holder-J.Bailey.`  
  _ATL vs CIN, 4th & 12 at CIN 20_
- `C.Smyth 52 yard field goal is No Good, Wide Right, Center-Z.Wood, Holder-R.Wright.`  
  _NO vs CLE, 4th & 14 at CLE 34_

### Sack Opp Fumble Recovery (40)
- `(Shotgun) D.Prescott sacked at DAL 16 for -5 yards (L.Latu). FUMBLES (L.Latu) [L.Latu], RECOVERED by IND-C.Curry at DAL 25. C.Curry to DAL 19 for 6 yards (T.Guyton).`  
  _IND vs DAL, 3rd & 8 at DAL 21_
- `(No Huddle, Shotgun) B.Young sacked at DEN 44 for -8 yards (N.Bonitto). FUMBLES (N.Bonitto) [N.Bonitto], RECOVERED by DEN-N.Bonitto at DEN 44.The Replay Official reviewed the fumble ruling, and the play was Upheld. The ruling on the field stands.`  
  _CAR vs DEN, 1st & 10 at DEN 36_

### End of Regulation (12)
- `END QUARTER 4`  
  _NO vs CLE_

### Blocked Field Goal (10)
- `C.Santos 23 yard field goal is BLOCKED (I.Rodgers), Center-B.Gardner, Holder-T.Taylor, recovered by CHI-T.Taylor at MIN 12.`  
  _CHI vs MIN, 4th & Goal at MIN 5_
- `T.Loop 49 yard field goal is BLOCKED (C.Granderson), Center-N.Moore, Holder-R.Eckley.`  
  _BAL vs NO, 4th & 13 at NO 31_

### Muffed Punt Recovery (Opponent) (8)
- `B.Mann punts 44 yards to NYG 42, Center-R.Underwood. C.Jones MUFFS catch, RECOVERED by PHI-R.Underwood at NYG 47.Penalty on NYG-N.Jones, Offensive Holding, declined.`  
  _PHI vs NYG, 4th & 2 at PHI 14_
- `T.Taylor punts 48 yards to CAR 22, Center-B.Gardner. Ji.Horn MUFFS catch, RECOVERED by CHI-K.Davis at CAR 28.`  
  _CAR vs CHI, 4th & 5 at CHI 30_

### Interception Return Touchdown (8)
- `(Shotgun) B.Mayfield pass short right intended for C.Otton INTERCEPTED by J.Johnson at CHI 33. J.Johnson for 67 yards, TOUCHDOWN. C.Santos extra point is GOOD, Center-S.Daly, Holder-T.Taylor.`  
  _CHI vs TB, 2nd & 9 at CHI 36_
- `(No Huddle, Shotgun) J.Burrow pass short right intended for A.Iosivas INTERCEPTED by J.Trotter [V.Vea] at CIN 38. J.Trotter for 38 yards, TOUCHDOWN. C.McLaughlin extra point is GOOD, Center-E.Deckers, Holder-R.Dixon.`  
  _CIN vs TB, 3rd & 5 at CIN 34_

### Fumble Return Touchdown (4)
- `(Shotgun) K.Murray pass short left to M.Price to NO 12 for 7 yards (M.Emerson; P.Werner). FUMBLES (M.Emerson), RECOVERED by NO-J.Sanker at NO 13. J.Sanker for 87 yards, TOUCHDOWN. D.Carlson extra point is No Good, Wide Left, Center-C.Adomitis, Holder-R.Wright.`  
  _NO vs MIN, 3rd & 15 at NO 19_
- `G.Holani left guard to SEA 0 for -4 yards (G.Halton). FUMBLES (G.Halton), touched at SEA 0, RECOVERED by SF-G.Halton at SEA -4. TOUCHDOWN. E.Pineiro extra point is GOOD, Center-J.Weeks, Holder-C.Waitman.`  
  _SEA vs SF, 1st & 10 at SEA 4_

### Safety (2)
- `(Shotgun) D.Prescott pass deep right intended for R.Flournoy INTERCEPTED by N.Cross at WAS -6. N.Cross tackled in End Zone, SAFETY NULLIFIED by Penalty (C.Lamb).PENALTY on WAS-C.Omenihu, Defensive Offside, 5 yards, enforced at WAS 11 - No Play.`  
  _DAL vs WSH, 3rd & 10 at WSH 11_
- `Demetrius Knight Jr. Safety`  
  _CIN vs TEN, 2nd & 12 at TEN 3_

### Kickoff Return Touchdown (2)
- `J.Elliott kicks 55 yards from PHI 35 to JAX 10. J.Cameron for 90 yards, TOUCHDOWN NULLIFIED by Penalty.Penalty on PHI-A.Epenesa, Illegal Formation, offsetting, enforced at PHI 35 - No Play.Penalty on JAX-B.Combs, Offensive Holding, offsetting.Penalty on JAX-Bry.Thomas, Disqualification, offsetting.Penalty on PHI-J.Trotter, Disqualification, offsetting.`  
  _JAX vs PHI_
- `A.McNamara kicks 60 yards from NYJ 35 to LV 5. D.Laube for 95 yards, TOUCHDOWN. M.Gay extra point is GOOD, Center-A.Ward, Holder-A.Cole.`  
  _NYJ vs LV_

### Blocked Punt (1)
- `J.Scott punt is BLOCKED by S.Fehoko, Center-J.Harris, recovered by LAC-A.Ingold at LAC 3.`  
  _LAC vs ARI, 4th & 11 at LAC 19_

### Punt Return Touchdown (1)
- `R.Dixon punts 41 yards to MIN 14, Center-E.Deckers. M.Price for 86 yards, TOUCHDOWN.PENALTY on MIN, Unsportsmanlike Conduct, 15 yards, enforced between downs. W.Reichard extra point is GOOD, Center-A.DePaola, Holder-J.Hekker.`  
  _TB vs MIN, 4th & 5 at TB 45_

### Blocked Punt Touchdown (1)
- `R.Sanchez punt is BLOCKED by J.Chestnut, Center-L.Rhodes, RECOVERED by TEN-O.Oladejo at IND 14. O.Oladejo for 14 yards, TOUCHDOWN. IND-R.Sanchez was injured during the play. PENALTY on TEN, Unsportsmanlike Conduct, 15 yards, enforced between downs. J.Slye extra point is GOOD, Center-M.Cox, Holder-T.Townsend.`  
  _IND vs TEN, 4th & 12 at IND 37_

### Defensive 2pt Conversion (1)
- `Zyon McCollum Defensive PAT Conversion`  
  _CAR vs TB, 2nd & 5 at CAR 0_

## Tipos de penal (campo `penalty.type`)

Aparece en 2014 jugadas. Solo se informa **un** penal por jugada aunque el texto mencione varios.

| Penal (`penalty.type.text`) | `slug` | Veces |
| --- | --- | ---: |
| Offensive Holding | `offensive-holding` | 422 |
| False Start | `false-start` | 379 |
| Defensive Pass Interference | `defensive-pass-interference` | 160 |
| Delay of Game | `delay-of-game` | 130 |
| Defensive Holding | `defensive-holding` | 99 |
| Unnecessary Roughness | `unnecessary-roughness` | 87 |
| Defensive Offside | `defensive-offside` | 85 |
| Roughing the Passer | `roughing-the-passer` | 61 |
| Neutral Zone Infraction | `neutral-zone-infraction` | 54 |
| Face Mask | `face-mask` | 54 |
| Illegal Formation | `illegal-formation` | 50 |
| Illegal Block Above the Waist | `illegal-block-above-the-waist` | 41 |
| Illegal Shift | `illegal-shift` | 41 |
| Illegal Use of Hands | `illegal-use-of-hands` | 38 |
| Illegal Contact | `illegal-contact` | 37 |
| Offensive Pass Interference | `offensive-pass-interference` | 35 |
| Encroachment | `encroachment` | 24 |
| Kickoff Short of Landing Zone | `kickoff-short-of-landing-zone` | 23 |
| Offsetting | `offsetting` | 22 |
| Ineligible Downfield Pass | `ineligible-downfield-pass` | 21 |
| Intentional Grounding | `intentional-grounding` | 20 |
| Unsportsmanlike Conduct | `unsportsmanlike-conduct` | 17 |
| Defensive Too Many Men on Field | `defensive-too-many-men-on-field` | 15 |
| Kickoff Out of Bounds | `kickoff-out-of-bounds` | 14 |
| Taunting | `taunting` | 12 |
| Illegal Blindside Block | `illegal-blindside-block` | 10 |
| Chop Block | `chop-block` | 7 |
| Offensive Offside | `offensive-offside` | 6 |
| Low Block | `low-block` | 6 |
| Lowering the Head to Make Forcible Contact | `lowering-the-head-to-make-forcible-contact` | 5 |
| Player Out of Bounds on Kick | `player-out-of-bounds-on-kick` | 5 |
| Illegal Touch Kick | `illegal-touch-kick` | 4 |
| Roughing the Kicker | `roughing-the-kicker` | 3 |
| Offensive Too Many Men on Field | `offensive-too-many-men-on-field` | 3 |
| Fair Catch Interference | `fair-catch-interference` | 3 |
| Illegal Double-Team Block | `illegal-double-team-block` | 2 |
| Tripping | `tripping` | 2 |
| Invalid Fair Catch Signal | `invalid-fair-catch-signal` | 2 |
| Defensive Delay of Game | `defensive-delay-of-game` | 2 |
| Horse Collar Tackle | `horse-collar-tackle` | 2 |
| Disqualification | `disqualification` | 2 |
| Running Into the Kicker | `running-into-the-kicker` | 2 |
| Illegal Forward Pass | `illegal-forward-pass` | 1 |
| Ineligible Downfield Kick | `ineligible-downfield-kick` | 1 |
| Illegal Touch Pass | `illegal-touch-pass` | 1 |
| Illegal Motion | `illegal-motion` | 1 |
| Leverage | `leverage` | 1 |
| Illegal Substitution | `illegal-substitution` | 1 |
| Illegal Forward Handoff | `illegal-forward-handoff` | 1 |

## Punto extra y conversión de 2 (campo `pointAfterAttempt`)

No son jugadas aparte: vienen dentro de la jugada del touchdown.

| `pointAfterAttempt.text` (valor) | Veces |
| --- | ---: |
| Extra Point Good (vale 1) | 594 |
| Two Point Pass (vale 0) | 28 |
| Extra Point Missed (vale 0) | 27 |
| Two Point Pass (vale 2) | 25 |
| Two Point Rush (vale 2) | 11 |
| Blocked PAT (vale 0) | 4 |
| Two Point Rush (vale 0) | 2 |
| Not Available (vale 0) | 2 |

## Cómo terminan los drives (`drive.displayResult`)

| Resultado | Veces |
| --- | ---: |
| Punt | 1039 |
| Touchdown | 675 |
| Field Goal | 487 |
| Interception | 191 |
| Downs | 165 |
| Fumble | 141 |
| End of Game | 109 |
| End of Half | 93 |
| Missed FG | 88 |
| Interception Touchdown | 9 |
| Fumble Return Touchdown | 4 |
| Fumble Touchdown | 3 |
| Safety | 2 |
| Blocked Punt, Downs | 1 |
| Blocked FG, Downs | 1 |
| Punt Touchdown | 1 |
| Blocked FG | 1 |
| Blocked Punt Touchdown | 1 |

## Diferencias entre los datos reales y la especificación

Comprobadas sobre los partidos guardados (13 nov 2026). Las que afectan al código están resueltas en `js/motor.js`.

1. **`yardLine` no es relativo a quien tiene el balón.** Es la distancia a la zona de anotación **del equipo local**, de 0 a 100 (comprobado en 2.715 de 2.715 jugadas contra `possessionText`). El local ataca hacia 100 y el visitante hacia 0. La especificación (4.6) habla de animar de `start.yardLine` a `end.yardLine`: sirve tal cual para dibujar, pero para explicar hay que convertirlo.
2. **`yardsToEndzone` no es fiable.** Vale 0 en tiempos fuera, avisos de dos minutos y finales de cuarto, y viene **invertido en la mitad de los punts** (cuando despeja el local). El motor lo calcula por su cuenta desde `yardLine`.
3. **`type.text` a veces está mal.** Vistos: un pase incompleto etiquetado "End Period", un "Safety" y un "Kickoff Return Touchdown" que en realidad fueron anulados por penal, y un "Timeout" cuyo texto es "Official Timeout". Por eso el motor decide con el texto **y** el tipo, no solo con el tipo.
4. **El punto extra y la conversión de 2 no son jugadas aparte.** Vienen dentro del texto del touchdown y en `pointAfterAttempt` (la especificación los lista como si fueran jugadas).
5. **El marcador de cada jugada (`homeScore`, `awayScore`) es el de después de la jugada**, con el punto extra ya sumado.
6. **Las abreviaturas del texto no son las de ESPN.** El texto usa las de la liga: BLT, CLV, WAS, LA, ARZ y HST donde ESPN usa BAL, CLE, WSH, LAR, ARI y HOU.
7. **Las jugadas revisadas traen las dos versiones en el mismo texto**: la original, la frase de la revisión ("...and the play was REVERSED.") y luego la corregida. Hay que leer la última.
8. **Hay campos útiles que la especificación no menciona:** `penalty` (`type.slug`, `yards`, `status`), `review`, `scoringType`, `pointAfterAttempt`, `yardsAfterCatch`, `isTurnover`, `isPenalty`, `scoringPlay`, `period.number` y `clock.displayValue`.
9. **`downDistanceText` falta** al inicio de las patadas de salida y al final de las jugadas de anotación (`down: -1`).
10. **En las patadas de salida, `start.team` es quien patea** y el drive pertenece a quien recibe. En tiempos fuera `start.team` no coincide con el drive la mitad de las veces: para esas filas se usa el equipo del drive.
11. **`drives.current` no aparece en ningún partido terminado.** Solo podrá comprobarse en vivo el domingo 15; el código lo trata como un drive más si existe.
12. **Unas pocas jugadas traen el texto corto de anotación de ESPN** en vez de la descripción de la liga (por ejemplo "Demetrius Knight Jr. Safety" o "Jalen Coker 26 Yd pass from Bryce Young"). Se explican con los campos estructurados.
13. **Tiempo extra:** `period.number` 5 con reloj desde 10:00, y existe el tipo "End of Regulation".
14. **El scoreboard acepta `?dates=2026&seasontype=2&week=N`** para pedir otra semana (mismo endpoint de la especificación; se usó para bajar semanas anteriores).
15. **El JSON trae enlaces a logos oficiales** (`team.logos`). No se usan en ninguna parte (restricción 3).
16. **Tipos conocidos de ESPN que no aparecieron en la muestra** (por ejemplo el regreso de un gol de campo fallado o el saque de moneda): quedan cubiertos por las reglas de texto y por el caso genérico, con pruebas sintéticas marcadas como tales.
