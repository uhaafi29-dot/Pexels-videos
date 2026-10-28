import {useMemo} from 'react';
import * as THREE from 'three';
import {clone as cloneSkinned} from 'three/examples/jsm/utils/SkeletonUtils.js';
import {useGltf} from './assets';

// The faceless figure: Mixamo's X Bot, re-dressed in a matte "artist's
// mannequin" material. Every pose is computed from the frame, so renders are
// deterministic: clip times are set explicitly instead of advancing a clock.

export type Pose = {
  /** world position of the feet */
  pos: THREE.Vector3;
  /** heading in radians (0 = facing +z) */
  heading: number;
  /** seconds into the walk cycle (if walking) */
  walkTime: number;
  /** 0 = idle, 1 = walking */
  walk: number;
  /** seconds into the idle cycle */
  idleTime: number;
  /** slumped "old self" posture, 0..1 */
  slump: number;
  /** looking down at a phone held in both hands, 0..1 */
  phone: number;
  /** carrying an object in the right hand, arm bent, 0..1 */
  carry: number;
  /** arms raised in a stretch / opening gesture, 0..1 */
  stretch: number;
  /** 1 = solid figure, <1 = translucent "echo" */
  opacity: number;
};

export const defaultPose = (p: Partial<Pose>): Pose => ({
  pos: new THREE.Vector3(),
  heading: 0,
  walkTime: 0,
  walk: 0,
  idleTime: 0,
  slump: 0,
  phone: 0,
  carry: 0,
  stretch: 0,
  opacity: 1,
  ...p,
});

type Rig = {
  root: THREE.Object3D;
  mixer: THREE.AnimationMixer;
  actions: Record<string, THREE.AnimationAction>;
  bones: Record<string, THREE.Bone>;
  materials: THREE.MeshPhysicalMaterial[];
  hand: THREE.Bone;
};

const BONES = ['Spine', 'Spine1', 'Spine2', 'Neck', 'Head', 'LeftArm', 'LeftForeArm', 'LeftHand', 'RightArm', 'RightForeArm', 'RightHand', 'LeftShoulder', 'RightShoulder'];

const wp = (o: THREE.Object3D) => o.getWorldPosition(new THREE.Vector3());

/**
 * Rotate `bone` (in world space) so that `child` points at `target`, blended
 * by weight. Independent of how each bone's local axes happen to be set up.
 */
const aim = (bone: THREE.Bone | undefined, child: THREE.Bone | undefined, target: THREE.Vector3, w: number) => {
  if (!bone || !child || w <= 0) return;
  bone.updateMatrixWorld(true);
  const from = wp(child).sub(wp(bone)).normalize();
  const to = target.clone().sub(wp(bone)).normalize();
  const delta = new THREE.Quaternion().setFromUnitVectors(from, to);
  const worldQ = bone.getWorldQuaternion(new THREE.Quaternion());
  const goal = delta.multiply(worldQ);
  const parentQ = bone.parent!.getWorldQuaternion(new THREE.Quaternion()).invert();
  const local = parentQ.multiply(goal);
  bone.quaternion.slerp(local, w);
  bone.updateMatrixWorld(true);
};

/** Tilt a bone forward (+) or back (-) about the figure's own left-right axis. */
const nod = (rig: Rig, bone: THREE.Bone | undefined, angle: number) => {
  if (!bone || angle === 0) return;
  const axis = new THREE.Vector3(1, 0, 0).applyQuaternion(rig.root.quaternion);
  const r = new THREE.Quaternion().setFromAxisAngle(axis, angle);
  const worldQ = bone.getWorldQuaternion(new THREE.Quaternion());
  const parentQ = bone.parent!.getWorldQuaternion(new THREE.Quaternion()).invert();
  bone.quaternion.copy(parentQ.multiply(r.multiply(worldQ)));
  bone.updateMatrixWorld(true);
};

export const useRig = (tint: THREE.ColorRepresentation = '#b9b2a8') => {
  const gltf = useGltf('assets/Xbot.glb');
  return useMemo<Rig>(() => buildRig(gltf, tint), [gltf, tint]);
};

export const buildRig = (gltf: {scene: THREE.Object3D; animations: THREE.AnimationClip[]}, tint: THREE.ColorRepresentation): Rig => {
  {
    const root = cloneSkinned(gltf.scene);
    const materials: THREE.MeshPhysicalMaterial[] = [];
    root.traverse((o) => {
      const m = o as THREE.SkinnedMesh;
      if (m.isSkinnedMesh) {
        const joints = (m.material as THREE.Material).name.includes('Joints');
        const mat = new THREE.MeshPhysicalMaterial({
          color: new THREE.Color(tint).multiplyScalar(joints ? 0.55 : 1),
          roughness: joints ? 0.45 : 0.62,
          metalness: 0,
          sheen: 0.4,
          sheenRoughness: 0.6,
          sheenColor: new THREE.Color('#f3e6d4'),
          clearcoat: 0.08,
          transparent: true,
        });
        m.material = mat;
        m.castShadow = true;
        m.receiveShadow = true;
        m.frustumCulled = false;
        materials.push(mat);
      }
    });
    const mixer = new THREE.AnimationMixer(root);
    const actions: Record<string, THREE.AnimationAction> = {};
    for (const clip of gltf.animations) {
      let c = clip;
      if (clip.name === 'sad_pose') {
        c = THREE.AnimationUtils.makeClipAdditive(clip.clone());
      }
      const a = mixer.clipAction(c);
      if (clip.name === 'sad_pose') a.blendMode = THREE.AdditiveAnimationBlendMode;
      a.play();
      a.setEffectiveWeight(0);
      actions[clip.name] = a;
    }
    const bones: Record<string, THREE.Bone> = {};
    root.traverse((o) => {
      const b = o as THREE.Bone;
      if (b.isBone) {
        const short = b.name.replace('mixamorig', '').replace(':', '');
        if (BONES.includes(short)) bones[short] = b;
      }
    });
    return {root, mixer, actions, bones, materials, hand: bones.RightHand};
  }
};

/** Apply a pose to a rig (clip weights + procedural bone offsets). */
export const applyPose = (rig: Rig, p: Pose) => {
  const {actions, bones} = rig;
  const walk = Math.min(1, Math.max(0, p.walk));
  actions.walk.setEffectiveWeight(walk);
  actions.walk.time = p.walkTime % actions.walk.getClip().duration;
  actions.idle.setEffectiveWeight(1 - walk);
  actions.idle.time = p.idleTime % actions.idle.getClip().duration;
  actions.sad_pose.setEffectiveWeight(p.slump);
  actions.sad_pose.time = 0;
  for (const k of ['run', 'agree', 'headShake', 'sneak_pose']) actions[k]?.setEffectiveWeight(0);
  rig.mixer.update(0);

  // Place the figure first, so the procedural layers can work in world space.
  rig.root.position.copy(p.pos);
  rig.root.rotation.set(0, p.heading, 0);
  rig.root.updateMatrixWorld(true);

  // Procedural layers on top of the clips: arm targets are given in the
  // figure's own space (metres; +x = its left, +z = forward, y = up from feet).
  const local = (x: number, y: number, z: number) => rig.root.localToWorld(new THREE.Vector3(x, y, z));
  const arm = (side: 'Left' | 'Right', elbow: THREE.Vector3, hand: THREE.Vector3, w: number) => {
    aim(bones[`${side}Arm`], bones[`${side}ForeArm`], elbow, w);
    aim(bones[`${side}ForeArm`], bones[`${side}Hand`], hand, w);
  };
  if (p.phone > 0) {
    arm('Left', local(0.2, 1.06, 0.06), local(0.05, 1.12, 0.3), p.phone);
    arm('Right', local(-0.2, 1.06, 0.06), local(-0.05, 1.12, 0.3), p.phone);
    nod(rig, bones.Neck, 0.3 * p.phone);
    nod(rig, bones.Head, 0.42 * p.phone);
  }
  if (p.carry > 0) arm('Right', local(-0.21, 1.02, 0.02), local(-0.16, 1.02, 0.3), p.carry);
  if (p.stretch > 0) {
    arm('Left', local(0.3, 1.72, 0.02), local(0.33, 2.02, 0.02), p.stretch);
    arm('Right', local(-0.3, 1.72, 0.02), local(-0.33, 2.02, 0.02), p.stretch);
    nod(rig, bones.Head, -0.3 * p.stretch);
  }

  for (const m of rig.materials) {
    m.opacity = p.opacity;
    m.depthWrite = p.opacity > 0.99;
  }
  rig.root.updateMatrixWorld(true);
};

export const Figure: React.FC<{pose: Pose; tint?: string; children?: React.ReactNode}> = ({pose, tint}) => {
  const rig = useRig(tint);
  applyPose(rig, pose);
  return <primitive object={rig.root} />;
};
