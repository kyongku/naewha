# CLAUDE.md — 내화 웹 프로젝트 작업 지시서

## 프로젝트 개요

- **게임명**: 내화 (耐火)
- **타겟**: 브라우저 실행, DB 없음, 순수 프론트엔드
- **캔버스**: 960×576
- **언어**: Vanilla JS (ES6 class, 'use strict')
- **파일 구조**:
  ```
  index.html
  css/style.css
  js/
    engine.js       # 상수, 수학 유틸, Input, Camera, Physics, moveAndSlide
    world.js        # Room, Door, 방 생성 함수
    projectiles.js  # Axe, PlayerProjectile, EnemyProjectile, Projectiles 풀
    player.js       # ComboSystem, DashSystem, AxeSystem, OxygenSystem, RangedSystem, Player
    enemies.js      # Enemy 베이스, Ember, MirrorShard, Golem, GolemAxe
    bosses.js       # Boss 베이스, Boss1, BossFinal
    game.js         # HUD, GameManager, GameState, Game (메인 루프)
  ```

---

## 모듈 책임 원칙

각 파일은 아래 책임만 가진다. 범위 밖의 로직을 추가하지 말 것.

| 파일 | 책임 | 금지 |
|------|------|------|
| engine.js | 수학 유틸, 입력, 카메라, 물리 계산 | 게임 상태 직접 참조 금지 |
| world.js | Room/Door 정의, 방 레이아웃 | Game/GameManager 직접 호출 금지 |
| projectiles.js | 발사체 이동/충돌/상태 관리 | Player 내부 상태 직접 조작 금지 |
| player.js | 플레이어 입력 처리, 서브시스템 | GameState/GameManager 직접 호출 금지 (콜백 사용) |
| enemies.js | 적 FSM, AI 로직 | Player 내부 필드 직접 조작 금지 |
| bosses.js | 보스 FSM, 패턴 | Game/GameManager 직접 호출 금지 (콜백 사용) |
| game.js | 씬 통합, 루프, HUD, 이벤트 조율 | 게임 로직 직접 구현 금지 (각 모듈에 위임) |

---

## 의존성 규칙

로드 순서 및 참조 방향은 단방향이어야 한다:

```
engine.js
  ↓
world.js
  ↓
projectiles.js
  ↓
player.js
  ↓
enemies.js
  ↓
bosses.js
  ↓
game.js
```

**하위 모듈이 상위 모듈을 직접 호출하는 것은 금지.**
대신 생성 시 콜백을 주입한다:

```js
// 금지
GameManager.unlockDash();

// 허용
const boss = new Boss1(x, y, {
  onDie: () => GameManager.unlockDash()
});
```

---

## 상태 관리 원칙

1. **게임 루프 외부에서 상태 변경 금지** — `setTimeout`으로 게임 상태를 바꾸지 말 것
   - 대신 엔티티 내부에 `deadTimer` 카운터를 두고 `update()` 안에서 처리

2. **타 모듈의 내부 필드 직접 조작 금지** — 반드시 메서드를 통해 접근
   ```js
   // 금지
   this._player.axeSys.hasAxe = true;

   // 허용
   this._player.axeSys.onAxePickedUp();
   ```

3. **전역 싱글턴 목록** (현재 구조상 유지, 신규 추가 금지)
   - `Projectiles`, `DmgNumbers`, `Vfx`, `Input`, `Camera`
   - `PhysicsAccum`, `GameManager`, `GameState`, `Game`, `HUD`

4. **Input.flush()는 물리 루프 안에서 처리** — 멀티스텝 시 입력 중복 발동 방지

---

## 알려진 버그 (수정 우선순위)

### 🔴 즉시 수정

1. **GolemAxe → AxeSystem 직접 필드 조작**
   - 위치: `enemies.js` GolemAxe._onDie()
   - 문제: `this._player.axeSys.hasAxe = true` 직접 대입
   - 수정: `this._player.axeSys.onAxePickedUp()` 메서드 호출로 교체

2. **순환 참조 (역방향 직접 호출)**
   - `world.js:Room._clear()` → `Game.onRoomCleared()` 직접 호출
   - `player.js:Player._die()` → `GameManager.onPlayerDeath()` 직접 호출
   - `bosses.js:Boss1._onDie()` → `GameManager.unlockDash()` 직접 호출
   - `bosses.js:BossFinal._onDie()` → `Game.showEnding()` 직접 호출
   - **수정**: 생성 시 콜백 주입 패턴으로 교체

3. **setTimeout 게임 상태 변경**
   - `enemies.js:71`, `bosses.js:70` — removeMe 타이머
   - `game.js:184` — resetScene 타이머
   - `bosses.js:446` — showEnding 타이머
   - **수정**: 내부 `deadTimer` 카운터로 교체

4. **Input.flush() 멀티스텝 문제**
   - 위치: `game.js` 물리 루프
   - 문제: steps >= 2일 때 pressed 입력이 중복 처리됨
   - **수정**: `flush()`를 루프 내부로 이동하거나 `processInput()`을 루프 밖으로 분리

### 🟡 구조적 개선 (점진적)

5. `player.js` 파일 분리 — 5개 서브시스템을 별도 파일로
6. `PHASE_COLORS` 중복 제거 — `player.js`와 `game.js` 두 곳에 정의됨
7. `Camera.rw` 이중 초기화 — `engine.js` 초기값과 `game.js` 덮어쓰기 통일
8. 보스 무적 시간 추가 — 연속 히트 시 hurt 상태 고착 방지

---

## 코딩 규칙

- 함수 하나는 한 가지 일만 한다
- 주석은 **왜(why)** 위주로, 무엇(what)은 코드로 표현
- 새 전역 싱글턴 추가 금지
- 파일당 책임 범위를 벗어나는 로직은 game.js에서 조율
- 인코딩: **UTF-8** (한글 주석 포함 시 필수)

---

## Resource Design

- Axe is the default weapon.
- Boss1 unlocks Oxygen.
- Boss2 unlocks Heat.
- Boss3 unlocks Smoke.
- Oxygen Gauge, Heat Gauge, and Smoke are separate concepts.
- Oxygen is a survival resource.
- The current random oxygen can drop system is planned to be replaced because it adds too much luck variance.
- Oxygen is planned to be gained through Q channeling.
- Oxygen maximum capacity should be designed to stay relatively low.
- Dash is planned to become an Oxygen-consuming mobility skill.
- Skill 3 is planned as an Oxygen-based healing skill that can be used in every form.
- Heat is an active combat resource.
- Heat is gained in proportion to damage dealt.
- Heat is a sustained-consumption resource rather than a passive timer refill.
- Heat and FIRE form are different concepts.
- Smoke is a crisis resource.
- Smoke increases when the player is hit.
- If Smoke is left unmanaged, it should create penalties.

## Heat Skills

- Heat Skill 1: NORMAL Heat Mode, focused on physical enhancement.
- Heat Skill 2: FIRE Heat Mode, focused on physical enhancement plus flame-based ranged attack access.
- Heat Skill 3: FIREMAN Heat Mode and WATER Heat Mode progression support.
- Ranged attack should not be permanently available by default.
- Ranged attack should not generate Heat.
- Each ranged attack use should consume additional Heat.
- Heat is not "fire-only" energy.
- Heat is a combat drive, output, and focus resource used across forms.

## Form Flow

- Form order: NORMAL -> FIRE -> FIREMAN -> WATER
- NORMAL Heat Mode = physical enhancement.
- FIRE Heat Mode = physical enhancement plus flame-based ranged attack.
- FIREMAN Heat Mode = stable suppression or rescue-oriented ranged attack powered by Heat.
- FIREMAN ranged attack is not a fire attack.
- FIREMAN ranged candidates: compressed water, water stream, suppression round, extinguishing spray, knockback, piercing.
- WATER Heat Mode = stronger damage reduction and absorption.
- WATER is not an invincibility form.
- WATER is a tank or absorption-oriented form with lower damage output.
- Exact performance, costs, and tuning should be decided after playtesting.

## Input Plan

- Oxygen Burst: W
- Oxygen Channel: Q
- Heat Skill 1: 1
- Heat Skill 2: 2
- Heat Skill 3: 3

## Balance Rule

- Exact coefficients, costs, durations, and damage multipliers are not fixed yet.
- These values should be decided only after real playtesting.

## Implementation Notes

- Do not implement `HeatSystem` yet.
- Do not delete the existing `OxygenSystem`.
- Do not merge oxygen and heat into a single shared resource.
- The current map is still a side-scrolling test structure.
- The issue where boss fights can still lead back into previous rooms should be fixed later when the map is replaced with a proper Metroidvania-style structure.

## Long-Term Architecture Layers

### 1. Engine Layer

- Input
- Camera
- Collision
- Shared math helpers
- VFX

### 2. Player Core Layer

- Movement
- Jump
- Hit reaction and damage intake
- Basic attack
- Do not keep expanding resource, skill, or form logic directly inside Player core.

### 3. Weapon Layer

- AxeSystem
- Axe throw
- Axe sticking
- Axe pickup
- Anchor dash
- Axe is the default weapon.

### 4. Resource Layer

- OxygenSystem
- HeatSystem
- SmokeSystem
- Oxygen, Heat, and Smoke must remain separate resources.

### 5. Form Layer

- NORMAL -> FIRE -> FIREMAN -> WATER
- Manage each form's baseline properties here.

### 6. Skill Layer

- Skill 1: survival skill
- Skill 2: damage or Heat Mode skill
- Skill 3: Oxygen recovery skill
- Skill effects should change depending on the current form and resource state.

### 7. Boss Reward Layer

- Boss1 -> Oxygen
- Boss2 -> Heat
- Boss3 -> Smoke
- Rewards should be managed through table-driven data, not hardcoded one-off feature wiring.

### 8. Content Layer

- Boss concepts
- Boss patterns
- Map structure
- Images, animation, and SFX

## Layer Rules

- Every new feature must be assigned to a layer before implementation.
- Do not keep adding temporary one-off features directly into `player.js`.
- Exact balance values should be decided only after playtesting.
