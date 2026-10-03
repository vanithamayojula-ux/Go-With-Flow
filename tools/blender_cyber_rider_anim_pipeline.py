"""
Blender Automated Cyberpunk Hoverboard Rider Animation Pipeline
================================================================
Game-Ready Hybrid Workflow: Mixamo Auto-Rig -> Manual Exaggeration & Refinement in Blender
Style: Subway Surfers-inspired Arcade Hoverboard Surfer
Timing: Fast, responsive, snappy transitions, continuous micro-movement, zero root motion.

Usage:
  blender --background --python tools/blender_cyber_rider_anim_pipeline.py
  OR run inside Blender's 'Scripting' workspace.
"""

import bpy
import math
from mathutils import Vector, Euler, Quaternion

# ---------------------------------------------------------------------------
# Configuration & Bone Hierarchy Mapping (Mixamo standard + Cyberpunk rig)
# ---------------------------------------------------------------------------
FPS = 60
EXPORT_FBX_PATH = "public/models/cyber_rider_animated.fbx"
EXPORT_GLB_PATH = "public/models/cyber_rider_animated.glb"

BONE_NAMES = {
    'hips': 'mixamorig:Hips',
    'spine': 'mixamorig:Spine',
    'spine1': 'mixamorig:Spine1',
    'spine2': 'mixamorig:Spine2',
    'neck': 'mixamorig:Neck',
    'head': 'mixamorig:Head',
    'armL': 'mixamorig:LeftArm',
    'forearmL': 'mixamorig:LeftForeArm',
    'handL': 'mixamorig:LeftHand',
    'armR': 'mixamorig:RightArm',
    'forearmR': 'mixamorig:RightForeArm',
    'handR': 'mixamorig:RightHand',
    'thighL': 'mixamorig:LeftUpLeg',
    'shinL': 'mixamorig:LeftLeg',
    'footL': 'mixamorig:LeftFoot',
    'thighR': 'mixamorig:RightUpLeg',
    'shinR': 'mixamorig:RightLeg',
    'footR': 'mixamorig:RightFoot',
    'board': 'Board_Root',
    'hair1': 'Hair_Base',
    'hair2': 'Hair_Mid',
    'hair3': 'Hair_Tip',
}

def get_or_create_armature():
    """Finds existing armature or builds standard arcade hoverboard rider rig."""
    for obj in bpy.data.objects:
        if obj.type == 'ARMATURE':
            return obj

    # Create procedural rig if no armature in scene
    bpy.ops.object.armature_add(enter_editmode=True, align='WORLD', location=(0, 0, 0))
    arm_obj = bpy.context.active_object
    arm_obj.name = "CyberRider_Armature"
    arm = arm_obj.data
    arm.name = "CyberRider_Rig"

    # Bone definitions
    edit_bones = arm.edit_bones
    root_b = edit_bones[0]
    root_b.name = BONE_NAMES['hips']
    root_b.head = (0, 0, 0.88)
    root_b.tail = (0, 0, 1.05)

    spine_b = edit_bones.new(BONE_NAMES['spine'])
    spine_b.head = (0, 0, 1.05)
    spine_b.tail = (0, 0, 1.25)
    spine_b.parent = root_b

    head_b = edit_bones.new(BONE_NAMES['head'])
    head_b.head = (0, 0, 1.45)
    head_b.tail = (0, 0, 1.72)
    head_b.parent = spine_b

    # Arms
    armL = edit_bones.new(BONE_NAMES['armL'])
    armL.head = (-0.18, 0, 1.35)
    armL.tail = (-0.45, 0, 1.35)
    armL.parent = spine_b

    forearmL = edit_bones.new(BONE_NAMES['forearmL'])
    forearmL.head = (-0.45, 0, 1.35)
    forearmL.tail = (-0.72, 0, 1.35)
    forearmL.parent = armL

    armR = edit_bones.new(BONE_NAMES['armR'])
    armR.head = (0.18, 0, 1.35)
    armR.tail = (0.45, 0, 1.35)
    armR.parent = spine_b

    forearmR = edit_bones.new(BONE_NAMES['forearmR'])
    forearmR.head = (0.45, 0, 1.35)
    forearmR.tail = (0.72, 0, 1.35)
    forearmR.parent = armR

    # Legs
    thighL = edit_bones.new(BONE_NAMES['thighL'])
    thighL.head = (-0.12, 0, 0.85)
    thighL.tail = (-0.14, 0.05, 0.45)
    thighL.parent = root_b

    shinL = edit_bones.new(BONE_NAMES['shinL'])
    shinL.head = (-0.14, 0.05, 0.45)
    shinL.tail = (-0.15, 0.12, 0.02)
    shinL.parent = thighL

    thighR = edit_bones.new(BONE_NAMES['thighR'])
    thighR.head = (0.12, 0, 0.85)
    thighR.tail = (0.14, -0.05, 0.45)
    thighR.parent = root_b

    shinR = edit_bones.new(BONE_NAMES['shinR'])
    shinR.head = (0.14, -0.05, 0.45)
    shinR.tail = (0.15, -0.12, 0.02)
    shinR.parent = thighR

    # Secondary hair chain
    h1 = edit_bones.new(BONE_NAMES['hair1'])
    h1.head = (0, -0.08, 1.62)
    h1.tail = (0, -0.22, 1.58)
    h1.parent = head_b

    h2 = edit_bones.new(BONE_NAMES['hair2'])
    h2.head = (0, -0.22, 1.58)
    h2.tail = (0, -0.38, 1.50)
    h2.parent = h1

    # Hoverboard root bone
    board_b = edit_bones.new(BONE_NAMES['board'])
    board_b.head = (0, 0, 0)
    board_b.tail = (0, 0.50, 0)

    bpy.ops.object.mode_set(mode='OBJECT')
    return arm_obj


def find_bone_or_alias(pose, key):
    name = BONE_NAMES.get(key, key)
    if name in pose.bones:
        return pose.bones[name]
    # Check stripped alias
    stripped = name.split(':')[-1]
    if stripped in pose.bones:
        return pose.bones[stripped]
    for b in pose.bones:
        if stripped.lower() in b.name.lower():
            return b
    return None


def set_bone_key(bone, frame, rot_euler=None, pos=None, scale=None):
    if not bone:
        return
    bone.rotation_mode = 'XYZ'
    if rot_euler is not None:
        bone.rotation_euler = Euler((math.radians(rot_euler[0]), math.radians(rot_euler[1]), math.radians(rot_euler[2])), 'XYZ')
        bone.keyframe_insert(data_path="rotation_euler", frame=frame)
    if pos is not None:
        bone.location = Vector(pos)
        bone.keyframe_insert(data_path="location", frame=frame)
    if scale is not None:
        bone.scale = Vector(scale)
        bone.keyframe_insert(data_path="scale", frame=frame)


def polish_fcurves(action):
    """Sets Graph Editor bezier handles for cartoon squash/stretch & snappy ease-in/ease-out across all Blender versions."""
    fcurves = []
    if hasattr(action, 'fcurves'):
        fcurves = list(action.fcurves)
    elif hasattr(action, 'layers'):
        for layer in action.layers:
            for strip in getattr(layer, 'strips', []):
                for bag in getattr(strip, 'channel_bags', []):
                    fcurves.extend(getattr(bag, 'fcurves', []))
    for fcurve in fcurves:
        for kp in getattr(fcurve, 'keyframe_points', []):
            kp.interpolation = 'BEZIER'
            kp.easing = 'AUTO'
            try:
                kp.handle_left_type = 'AUTO_CLAMPED'
                kp.handle_right_type = 'AUTO_CLAMPED'
            except Exception:
                pass


# ===========================================================================
# ANIMATION TRACK BUILDERS (11 High-Speed Arcade Actions)
# ===========================================================================

def build_all_animations(arm_obj):
    bpy.context.view_layer.objects.active = arm_obj
    bpy.ops.object.mode_set(mode='POSE')
    pose = arm_obj.pose

    actions = []

    # -----------------------------------------------------------------------
    # 1. BASE RIDING (IDLE LOOP): 60 frames (1.0s @ 60fps)
    # Stance: Deep surf crouch, knees bent, hips dropped, 4Hz bounce, side sway, hair wave
    # -----------------------------------------------------------------------
    act_idle = bpy.data.actions.new("Hover_BaseRiding_Idle")
    arm_obj.animation_data_create()
    arm_obj.animation_data.action = act_idle

    for f in range(1, 61):
        t = (f - 1) / 60.0
        bounce = math.sin(t * math.pi * 8.0) * 0.02
        sway = math.sin(t * math.pi * 2.0) * 2.5
        hair_wave = math.sin(t * math.pi * 4.0 - 0.5) * 8.0

        set_bone_key(find_bone_or_alias(pose, 'hips'), f, rot_euler=(4.5, 31.0, sway), pos=(0, 0, bounce), scale=(1.02, 1.0, 0.98 + bounce * 2.0))
        set_bone_key(find_bone_or_alias(pose, 'spine'), f, rot_euler=(9.0, 0, -sway * 0.8))
        set_bone_key(find_bone_or_alias(pose, 'head'), f, rot_euler=(6.0, -25.0, -sway * 0.5))

        # Counterbalanced surfing arms
        set_bone_key(find_bone_or_alias(pose, 'armL'), f, rot_euler=(28.0 + sway * 1.5, 0, -20.0))
        set_bone_key(find_bone_or_alias(pose, 'forearmL'), f, rot_euler=(48.0, 0, 0))
        set_bone_key(find_bone_or_alias(pose, 'armR'), f, rot_euler=(-25.0 - sway * 1.5, 0, 15.0))
        set_bone_key(find_bone_or_alias(pose, 'forearmR'), f, rot_euler=(40.0, 0, 0))

        # Athletic knee bend
        set_bone_key(find_bone_or_alias(pose, 'thighL'), f, rot_euler=(-20.0 + bounce * 40.0, 0, 1.0))
        set_bone_key(find_bone_or_alias(pose, 'shinL'), f, rot_euler=(33.0 - bounce * 40.0, 0, 0))
        set_bone_key(find_bone_or_alias(pose, 'thighR'), f, rot_euler=(-17.0 - bounce * 40.0, 0, -1.0))
        set_bone_key(find_bone_or_alias(pose, 'shinR'), f, rot_euler=(30.0 + bounce * 40.0, 0, 0))

        # Secondary hair motion
        set_bone_key(find_bone_or_alias(pose, 'hair1'), f, rot_euler=(12.0 + hair_wave, 0, 0))
        set_bone_key(find_bone_or_alias(pose, 'hair2'), f, rot_euler=(18.0 + hair_wave * 1.4, 0, 0))

        # Subtle board idle float
        set_bone_key(find_bone_or_alias(pose, 'board'), f, rot_euler=(0, 0, sway * 0.6), pos=(0, 0, bounce * 0.5))

    polish_fcurves(act_idle)
    actions.append(act_idle)

    # -----------------------------------------------------------------------
    # 2. LANE SWITCH LEFT: 12 frames (~0.20s @ 60fps)
    # Fast snap: Frame 1 normal -> Frame 4-7 extreme -38° bank, opposite arm extended -> Frame 12 snap back
    # -----------------------------------------------------------------------
    act_left = bpy.data.actions.new("Hover_LaneSwitch_Left")
    arm_obj.animation_data.action = act_left

    key_frames = [
        (1, 0.0),    # Base
        (4, -38.0),  # Peak extreme knife-edge carve
        (8, -25.0),  # Follow-through
        (12, 0.0)    # Instant snap recovery
    ]
    for f, lean in key_frames:
        factor = lean / -38.0
        set_bone_key(find_bone_or_alias(pose, 'hips'), f, rot_euler=(4.0, 20.0, lean * 0.9), pos=(-factor * 0.12, 0, -factor * 0.05))
        set_bone_key(find_bone_or_alias(pose, 'spine'), f, rot_euler=(12.0, 0, lean * 0.7))
        # Opposite arm (Right) extended high across body for cartoon silhouette
        set_bone_key(find_bone_or_alias(pose, 'armR'), f, rot_euler=(-55.0 * factor, 0, 65.0 * factor))
        set_bone_key(find_bone_or_alias(pose, 'armL'), f, rot_euler=(45.0 * factor, 0, -45.0 * factor))
        # Board hard tilt
        set_bone_key(find_bone_or_alias(pose, 'board'), f, rot_euler=(0, 0, lean * 0.75))
        # Hair whips right (opposing inertia)
        set_bone_key(find_bone_or_alias(pose, 'hair1'), f, rot_euler=(15.0, 0, factor * 28.0))

    polish_fcurves(act_left)
    actions.append(act_left)

    # -----------------------------------------------------------------------
    # 3. LANE SWITCH RIGHT: 12 frames (~0.20s @ 60fps)
    # -----------------------------------------------------------------------
    act_right = bpy.data.actions.new("Hover_LaneSwitch_Right")
    arm_obj.animation_data.action = act_right

    for f, lean in [(1, 0.0), (4, 38.0), (8, 25.0), (12, 0.0)]:
        factor = lean / 38.0
        set_bone_key(find_bone_or_alias(pose, 'hips'), f, rot_euler=(4.0, 38.0, lean * 0.9), pos=(factor * 0.12, 0, -factor * 0.05))
        set_bone_key(find_bone_or_alias(pose, 'spine'), f, rot_euler=(12.0, 0, lean * 0.7))
        # Opposite arm (Left) extended high across body
        set_bone_key(find_bone_or_alias(pose, 'armL'), f, rot_euler=(55.0 * factor, 0, -65.0 * factor))
        set_bone_key(find_bone_or_alias(pose, 'armR'), f, rot_euler=(-45.0 * factor, 0, 45.0 * factor))
        # Board hard tilt
        set_bone_key(find_bone_or_alias(pose, 'board'), f, rot_euler=(0, 0, lean * 0.75))
        # Hair whips left
        set_bone_key(find_bone_or_alias(pose, 'hair1'), f, rot_euler=(15.0, 0, -factor * 28.0))

    polish_fcurves(act_right)
    actions.append(act_right)

    # -----------------------------------------------------------------------
    # 4. BOOST MODE (Overdrive Tuck): 18 frames (~0.30s transition & loop)
    # Aggressive aerodynamic speed tuck: hips dropped -0.22, arms pulled back like jet wings
    # -----------------------------------------------------------------------
    act_boost = bpy.data.actions.new("Hover_Boost_Overdrive")
    arm_obj.animation_data.action = act_boost

    for f in range(1, 19):
        shiver = (1 if f % 2 == 0 else -1) * 0.005
        set_bone_key(find_bone_or_alias(pose, 'hips'), f, rot_euler=(18.0, 18.0, 0), pos=(0, 0.05, -0.22 + shiver), scale=(1.05, 1.15, 0.88))
        set_bone_key(find_bone_or_alias(pose, 'spine'), f, rot_euler=(28.0, 0, 0))
        set_bone_key(find_bone_or_alias(pose, 'head'), f, rot_euler=(-14.0, -18.0, 0)) # Look up through brow

        # Jet wing arms swept back
        set_bone_key(find_bone_or_alias(pose, 'armL'), f, rot_euler=(-42.0, 0, -32.0))
        set_bone_key(find_bone_or_alias(pose, 'forearmL'), f, rot_euler=(20.0, 0, 0))
        set_bone_key(find_bone_or_alias(pose, 'armR'), f, rot_euler=(-42.0, 0, 32.0))
        set_bone_key(find_bone_or_alias(pose, 'forearmR'), f, rot_euler=(20.0, 0, 0))

        # Deep leg compression
        set_bone_key(find_bone_or_alias(pose, 'thighL'), f, rot_euler=(-45.0, 0, 0))
        set_bone_key(find_bone_or_alias(pose, 'shinL'), f, rot_euler=(65.0, 0, 0))
        set_bone_key(find_bone_or_alias(pose, 'thighR'), f, rot_euler=(-42.0, 0, 0))
        set_bone_key(find_bone_or_alias(pose, 'shinR'), f, rot_euler=(62.0, 0, 0))

        # Intense horizontal hair trail streaming
        set_bone_key(find_bone_or_alias(pose, 'hair1'), f, rot_euler=(55.0 + shiver * 40.0, 0, 0))
        set_bone_key(find_bone_or_alias(pose, 'hair2'), f, rot_euler=(75.0 + shiver * 60.0, 0, 0))

    polish_fcurves(act_boost)
    actions.append(act_boost)

    # -----------------------------------------------------------------------
    # 5. JUMP (Subway Surfers Stylized Arc): 30 frames (~0.50s)
    # F1-3: Anticipation squash -> F4-18: Air tuck + nose up 35° -> F19-24: Soft landing bend -> F25-30: Snap recovery
    # -----------------------------------------------------------------------
    act_jump = bpy.data.actions.new("Hover_Jump_Airborne")
    arm_obj.animation_data.action = act_jump

    jump_keys = [
        # (frame, hips_y_offset, squash_stretch_z, board_pitch, knee_tuck, arm_spread)
        (1, 0.0, 1.0, 0.0, 0.0, 0.0),
        (3, -0.15, 0.85, -5.0, 0.4, -0.2),      # Quick anticipation crouch
        (6, 0.25, 1.25, 25.0, 0.8, 0.6),       # Explosive upward launch
        (14, 0.35, 1.05, 35.0, 1.0, 0.8),      # Apex air tuck (knees high to chest, board nose up)
        (22, 0.10, 1.15, 15.0, 0.6, 0.4),      # Downward descent
        (25, -0.18, 0.80, -2.0, 0.5, 0.1),     # Soft impact landing squash
        (30, 0.0, 1.0, 0.0, 0.0, 0.0)          # Snappy recovery to surf stance
    ]

    for f, hy, sz, bpitch, tuck, spread in jump_keys:
        set_bone_key(find_bone_or_alias(pose, 'hips'), f, rot_euler=(bpitch * 0.4, 25.0, 0), pos=(0, 0, hy), scale=(1.0 / math.sqrt(sz), 1.0 / math.sqrt(sz), sz))
        set_bone_key(find_bone_or_alias(pose, 'spine'), f, rot_euler=(15.0 * (1.0 - tuck), 0, 0))

        # Stylized spread arms
        set_bone_key(find_bone_or_alias(pose, 'armL'), f, rot_euler=(10.0, 0, -35.0 - spread * 35.0))
        set_bone_key(find_bone_or_alias(pose, 'armR'), f, rot_euler=(-10.0, 0, 35.0 + spread * 35.0))

        # Knees pulled up to chest in midair
        set_bone_key(find_bone_or_alias(pose, 'thighL'), f, rot_euler=(-20.0 - tuck * 35.0, 0, 0))
        set_bone_key(find_bone_or_alias(pose, 'shinL'), f, rot_euler=(33.0 + tuck * 45.0, 0, 0))
        set_bone_key(find_bone_or_alias(pose, 'thighR'), f, rot_euler=(-17.0 - tuck * 35.0, 0, 0))
        set_bone_key(find_bone_or_alias(pose, 'shinR'), f, rot_euler=(30.0 + tuck * 45.0, 0, 0))

        # Board pitches upward dynamically
        set_bone_key(find_bone_or_alias(pose, 'board'), f, rot_euler=(bpitch, 0, 0), pos=(0, 0, hy * 0.4))

    polish_fcurves(act_jump)
    actions.append(act_jump)

    # -----------------------------------------------------------------------
    # 6. TRICK 1: ONE-LEG BALANCE (24 frames)
    # Front foot locked to kicktail, back leg and arm kicked out in dynamic diagonal karate stance
    # -----------------------------------------------------------------------
    act_t1 = bpy.data.actions.new("Hover_Trick_OneLegBalance")
    arm_obj.animation_data.action = act_t1

    for f, blend in [(1, 0.0), (6, 0.7), (12, 1.0), (18, 0.7), (24, 0.0)]:
        set_bone_key(find_bone_or_alias(pose, 'hips'), f, rot_euler=(5.0, 45.0 * blend, 15.0 * blend), pos=(0, 0, 0.12 * blend))
        # Front leg stays anchored
        set_bone_key(find_bone_or_alias(pose, 'thighL'), f, rot_euler=(-25.0 * blend, 0, 0))
        set_bone_key(find_bone_or_alias(pose, 'shinL'), f, rot_euler=(45.0 * blend, 0, 0))
        # Back leg kicks out in exaggerated airborne balance
        set_bone_key(find_bone_or_alias(pose, 'thighR'), f, rot_euler=(-75.0 * blend, 0, -45.0 * blend))
        set_bone_key(find_bone_or_alias(pose, 'shinR'), f, rot_euler=(15.0 * blend, 0, 0))
        # Extended balance arm
        set_bone_key(find_bone_or_alias(pose, 'armR'), f, rot_euler=(-65.0 * blend, 0, 75.0 * blend))
        set_bone_key(find_bone_or_alias(pose, 'board'), f, rot_euler=(15.0 * blend, 0, 25.0 * blend))

    polish_fcurves(act_t1)
    actions.append(act_t1)

    # -----------------------------------------------------------------------
    # 7. TRICK 2: BOARD SPIN 360° (24 frames)
    # Pop jump -> board corkscrews 360° beneath rider -> solid stomp recovery
    # -----------------------------------------------------------------------
    act_t2 = bpy.data.actions.new("Hover_Trick_BoardSpin")
    arm_obj.animation_data.action = act_t2

    for f in range(1, 25):
        t = (f - 1) / 23.0
        spin_yaw = t * 360.0
        hop = math.sin(t * math.pi) * 0.28

        set_bone_key(find_bone_or_alias(pose, 'hips'), f, rot_euler=(0, 31.0 + math.sin(t * math.pi) * 45.0, 0), pos=(0, 0, hop))
        set_bone_key(find_bone_or_alias(pose, 'board'), f, rot_euler=(math.sin(t * math.pi * 2.0) * 15.0, spin_yaw, 0), pos=(0, 0, hop * 0.3))
        set_bone_key(find_bone_or_alias(pose, 'thighL'), f, rot_euler=(-40.0 * math.sin(t * math.pi), 0, 0))
        set_bone_key(find_bone_or_alias(pose, 'thighR'), f, rot_euler=(-40.0 * math.sin(t * math.pi), 0, 0))

    polish_fcurves(act_t2)
    actions.append(act_t2)

    # -----------------------------------------------------------------------
    # 8. TRICK 3: SIDE KICK POSE (24 frames)
    # Grab board rail with left hand, launch exaggerated side kick into the air
    # -----------------------------------------------------------------------
    act_t3 = bpy.data.actions.new("Hover_Trick_SideKickPose")
    arm_obj.animation_data.action = act_t3

    for f, blend in [(1, 0.0), (6, 0.65), (12, 1.0), (18, 0.65), (24, 0.0)]:
        set_bone_key(find_bone_or_alias(pose, 'hips'), f, rot_euler=(10.0 * blend, -25.0 * blend, -20.0 * blend), pos=(0, 0, 0.15 * blend))
        # Left arm grabs board rail
        set_bone_key(find_bone_or_alias(pose, 'armL'), f, rot_euler=(65.0 * blend, 0, -45.0 * blend))
        set_bone_key(find_bone_or_alias(pose, 'forearmL'), f, rot_euler=(85.0 * blend, 0, 0))
        # Right leg launches dynamic martial arts side kick
        set_bone_key(find_bone_or_alias(pose, 'thighR'), f, rot_euler=(-85.0 * blend, 0, 65.0 * blend))
        set_bone_key(find_bone_or_alias(pose, 'shinR'), f, rot_euler=(10.0 * blend, 0, 0))
        set_bone_key(find_bone_or_alias(pose, 'board'), f, rot_euler=(-20.0 * blend, 0, -30.0 * blend))

    polish_fcurves(act_t3)
    actions.append(act_t3)

    # -----------------------------------------------------------------------
    # 9. HIT / COLLISION (Recoil Jerk): 15 frames (~0.25s)
    # Sudden violent backward jerk, arms flail outward, instant snappy recovery
    # -----------------------------------------------------------------------
    act_hit = bpy.data.actions.new("Hover_Hit_Collision")
    arm_obj.animation_data.action = act_hit

    for f, jerk in [(1, 0.0), (3, -35.0), (6, -20.0), (10, 8.0), (15, 0.0)]:
        factor = jerk / -35.0
        set_bone_key(find_bone_or_alias(pose, 'hips'), f, rot_euler=(jerk * 0.8, 31.0, 0), pos=(0, -factor * 0.15, -factor * 0.08), scale=(0.95, 0.95, 1.10 * factor if factor > 0 else 1.0))
        set_bone_key(find_bone_or_alias(pose, 'spine'), f, rot_euler=(jerk * 0.7, 0, 0))
        set_bone_key(find_bone_or_alias(pose, 'head'), f, rot_euler=(jerk * 0.9, 0, 0)) # Head snaps back violently
        # Arms flail wildly
        set_bone_key(find_bone_or_alias(pose, 'armL'), f, rot_euler=(45.0 * factor, 0, -75.0 * factor))
        set_bone_key(find_bone_or_alias(pose, 'armR'), f, rot_euler=(-45.0 * factor, 0, 75.0 * factor))
        # Hair snaps forward
        set_bone_key(find_bone_or_alias(pose, 'hair1'), f, rot_euler=(-35.0 * factor, 0, 0))

    polish_fcurves(act_hit)
    actions.append(act_hit)

    # -----------------------------------------------------------------------
    # 10. FLOW CARVE (Wide S-Curve Banking): 48 frames
    # -----------------------------------------------------------------------
    act_carve = bpy.data.actions.new("Hover_FlowCarve")
    arm_obj.animation_data.action = act_carve

    for f in range(1, 49):
        t = (f - 1) / 48.0
        bank = math.sin(t * math.pi * 2.0) * 28.0
        set_bone_key(find_bone_or_alias(pose, 'hips'), f, rot_euler=(5.0, 31.0 + bank * 0.2, bank * 0.7))
        set_bone_key(find_bone_or_alias(pose, 'spine'), f, rot_euler=(10.0, 0, bank * 0.6))
        set_bone_key(find_bone_or_alias(pose, 'board'), f, rot_euler=(0, 0, bank * 0.85))
        set_bone_key(find_bone_or_alias(pose, 'hair1'), f, rot_euler=(15.0, 0, -bank * 0.5))

    polish_fcurves(act_carve)
    actions.append(act_carve)

    # -----------------------------------------------------------------------
    # 11. MICRO-MOTION LAYER (Continuous Breathing & Physics): 30 frames
    # -----------------------------------------------------------------------
    act_micro = bpy.data.actions.new("Hover_MicroMotion_Breathing")
    arm_obj.animation_data.action = act_micro

    for f in range(1, 31):
        t = (f - 1) / 30.0
        breathe = math.sin(t * math.pi * 2.0) * 0.015
        set_bone_key(find_bone_or_alias(pose, 'spine'), f, scale=(1.0 + breathe * 0.8, 1.0 + breathe * 0.8, 1.0 + breathe))
        set_bone_key(find_bone_or_alias(pose, 'hair1'), f, rot_euler=(12.0 + breathe * 120.0, 0, 0))

    polish_fcurves(act_micro)
    actions.append(act_micro)

    # Return to resting action
    arm_obj.animation_data.action = act_idle
    bpy.ops.object.mode_set(mode='OBJECT')
    return actions


def push_actions_to_nla(arm_obj, actions):
    """Pushes every generated action into separate NLA tracks for unified multi-clip FBX/GLB export."""
    if not arm_obj.animation_data:
        arm_obj.animation_data_create()
    nla = arm_obj.animation_data.nla_tracks

    # Clear existing tracks
    for t in list(nla):
        nla.remove(t)

    for act in actions:
        track = nla.new()
        track.name = act.name
        strip = track.strips.new(act.name, int(act.frame_range[0]), act)
        strip.name = act.name
        strip.extrapolation = 'HOLD'


def export_game_assets(arm_obj):
    """Exports multi-animation FBX and GLTF/GLB with root motion disabled."""
    bpy.ops.object.select_all(action='DESELECT')
    arm_obj.select_set(True)
    bpy.context.view_layer.objects.active = arm_obj

    # 1. Export FBX (All actions, no root motion)
    try:
        bpy.ops.export_scene.fbx(
            filepath=EXPORT_FBX_PATH,
            use_selection=False,
            bake_anim=True,
            bake_anim_use_all_bones=True,
            bake_anim_use_nla_strips=True,
            bake_anim_use_all_actions=True,
            bake_anim_step=1.0,
            bake_anim_simplify_factor=0.0,
            add_leaf_bones=False,
            primary_bone_axis='Y',
            secondary_bone_axis='X',
            axis_forward='-Z',
            axis_up='Y'
        )
        print(f"[BlenderPipeline] FBX exported successfully -> {EXPORT_FBX_PATH}")
    except Exception as e:
        print(f"[BlenderPipeline] FBX export warning: {e}")

    # 2. Export GLTF / GLB (All actions, no root motion)
    try:
        bpy.ops.export_scene.gltf(
            filepath=EXPORT_GLB_PATH,
            export_format='GLB',
            export_animations=True,
            export_nla_strips=True,
            export_frame_step=1,
            export_anim_single_armature=True,
            export_reset_pose_bones=True
        )
        print(f"[BlenderPipeline] GLB exported successfully -> {EXPORT_GLB_PATH}")
    except Exception as e:
        print(f"[BlenderPipeline] GLTF export warning: {e}")


def main():
    print("=== STARTING BLENDER CYBERPUNK HOVERBOARD RIDER PIPELINE ===")
    arm_obj = get_or_create_armature()
    actions = build_all_animations(arm_obj)
    push_actions_to_nla(arm_obj, actions)
    export_game_assets(arm_obj)
    print(f"=== COMPLETED: {len(actions)} ARCADE ACTIONS BAKED & EXPORTED ===")


if __name__ == '__main__':
    main()
