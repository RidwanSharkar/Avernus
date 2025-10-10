// src/components/environment/CustomSkeleton.tsx
import React, { useRef } from 'react';
import { Group, Mesh, MeshStandardMaterial, SphereGeometry, CylinderGeometry, ConeGeometry } from 'three';
import BonePlate from '../dragon/BonePlate';

interface CustomSkeletonProps {
  position: [number, number, number];
  rotation?: [number, number, number];
}

// Reuse Materials
const standardBoneMaterial = new MeshStandardMaterial({
  color: "#d8e8d8",
  roughness: 0.4,
  metalness: 0.3,
  emissive: "#330000", // Red glow
  emissiveIntensity: 0.2
});

const darkBoneMaterial = new MeshStandardMaterial({
  color: "#c4d4c4",
  roughness: 0.3,
  metalness: 0.4,
  emissive: "#220000", // Darker red glow
  emissiveIntensity: 0.15
});

// Cache geometries that are reused frequently
const jointGeometry = new SphereGeometry(0.06, 8, 8);
const smallBoneGeometry = new CylinderGeometry(0.04, 0.032, 1, 6);
const clawGeometry = new ConeGeometry(0.02, 0.15, 6);

function BoneLegModel() {
  // Simplified version that reuses geometries and materials
  const createBoneSegment = (length: number, width: number) => (
    <mesh geometry={smallBoneGeometry} material={standardBoneMaterial} scale={[width/0.04, length, width/0.04]} />
  );

  const createJoint = (size: number) => (
    <mesh geometry={jointGeometry} material={standardBoneMaterial} scale={[size/0.06, size/0.06, size/0.06]} />
  );

  const createParallelBones = (length: number, spacing: number) => (
    <group>
      <group position={[spacing/2, 0, 0]}>
        {createBoneSegment(length, 0.04)}
      </group>
      <group position={[-spacing/2, 0, 0]}>
        {createBoneSegment(length, 0.04)}
      </group>
      <group position={[0, length/2, 0]}>
        {createJoint(0.06)}
      </group>
      <group position={[0, -length/2, 0]}>
        {createJoint(0.06)}
      </group>
    </group>
  );

  return (
    <group>
      {/* Upper leg */}
      <group>
        {createParallelBones(0.65, 0.05)}

        {/* Knee joint */}
        <group position={[0, -0.45, 0]}>
          <mesh>
            <sphereGeometry args={[0.08, 12, 12]} />
            <meshStandardMaterial color="#d8e8d8" roughness={0.4} metalness={0.3} />
          </mesh>

          {/* Lower leg */}
          <group position={[0, -0.15, 0]}>
            {createParallelBones(0.7, 0.06)}

            {/* Ankle */}
            <group position={[0, -0.25, 0]} rotation={[Math.PI/2, 0, 0]}>
   

              {/* Foot structure */}
              <group position={[0, -0.015, 0.1]}>
                {/* Main foot plate */}
                <mesh>
                  <boxGeometry args={[0.15, 0.02, 0.4]} />
                  <meshStandardMaterial color="#d8e8d8" roughness={0.4} metalness={0.3} />
                </mesh>

                {/* Toe bones */}
                {[-0.05, 0, 0.05].map((offset, i) => (
                  <group key={i} position={[offset, 0.15, 0.25]} rotation={[-Math.PI, 0, 0]}>
                    {/* Toe bone segments */}
                    <group>
                      {createParallelBones(0.15, 0.02)}

                      {/* Toe claws */}
                      <group position={[0, -0.1, 0]} rotation={[Math.PI/6, 0, 0]}>
                        <mesh geometry={clawGeometry} material={darkBoneMaterial} />
                      </group>
                    </group>
                  </group>
                ))}
              </group>
            </group>
          </group>
        </group>
      </group>
    </group>
  );
}

function BossClawModel({ isLeftHand = false }: { isLeftHand?: boolean }) {
  // Reuse geometries and materials
  const createBoneSegment = (length: number, width: number) => (
    <mesh geometry={smallBoneGeometry} material={standardBoneMaterial} scale={[width/0.04, length, width/0.04]} />
  );

  const createJoint = (size: number) => (
    <mesh geometry={jointGeometry} material={standardBoneMaterial} scale={[size/0.06, size/0.06, size/0.06]} />
  );

  const createParallelBones = (length: number, spacing: number) => (
    <group>
      <group position={[spacing/2, 0, 0]}>
        {createBoneSegment(length, 0.06)}
      </group>
      <group position={[-spacing/2, 0, 0]}>
        {createBoneSegment(length, 0.06)}
      </group>
      <group position={[0, length/2, 0]}>
        {createJoint(0.08)}
      </group>
      <group position={[0, -length/2, 0]}>
        {createJoint(0.08)}
      </group>
    </group>
  );

  return (
    <group>
      <group>
        {createParallelBones(1.3, 0.15)}

        <group position={[0.25, -0.85, 0.21]}>
          <mesh>
            <sphereGeometry args={[0.12, 12, 12]} />
            <meshStandardMaterial
              color="#e8e8e8"
              roughness={0.4}
              metalness={0.3}
              emissive="#440000"
              emissiveIntensity={0.25}
            />
          </mesh>

          <group rotation={[-0.7, -0, Math.PI / 5]}>
            {createParallelBones(0.8, 0.12)}

            <group position={[0, -0.5, 0]} rotation={[0, 0, Math.PI / 5.5]}>
              {createJoint(0.09)}

              <group position={[0, -0.1, 0]}>
                <mesh>
                  <boxGeometry args={[0.2, 0.15, 0.08]} />
                  <meshStandardMaterial color="#e8e8e8" roughness={0.4} emissive="#440000" emissiveIntensity={0.25} />
                </mesh>
                {[-0.08, 0, 0.08].map((offset, i) => ( // Reduced from 5 fingers to 3
                  <group
                    key={i}
                    position={[offset, -0.1, 0]}
                    rotation={[0, 0, (i - 1) * Math.PI / 8]}
                  >
                    {createBoneSegment(0.5, 0.02)}
                    <group position={[0.025, -0.3, 0]} rotation={[0, 0, Math.PI + Math.PI / 16]}>
                      <mesh geometry={clawGeometry} material={darkBoneMaterial} />
                    </group>
                  </group>
                ))}

                {/* Only render sabre if it's the left hand */}
                {!isLeftHand && (
                  <group position={[0, -0.2, 0.3]} rotation={[Math.PI/1.5, 0, -Math.PI/4]} scale={[1.8, 2.5, 1.8]}>
                    {/* Simple bone sabre representation */}
                    <mesh>
                      <cylinderGeometry args={[0.02, 0.03, 1.2, 6]} />
                      <meshStandardMaterial color="#d8e8d8" roughness={0.4} metalness={0.3} emissive="#330000" emissiveIntensity={0.2} />
                    </mesh>
                  </group>
                )}
              </group>
            </group>
          </group>
        </group>
      </group>
    </group>
  );
}

function ShoulderPlate() {
  return (
    <group>
      {/* Main shoulder plate with layered armor design */}
      <group>
        {/* Base plate */}
        <mesh>
          <cylinderGeometry args={[0.123, 0.19, 0.175, 6, 1, false, 0, Math.PI*2]} />
          <meshStandardMaterial
            color="#e8e8e8"
            roughness={0.4}
            metalness={0.3}
            emissive="#440000"
            emissiveIntensity={0.25}
          />
        </mesh>

        {/* Overlapping armor plates */}
        {[0, 1, 2, 3].map((i) => ( // Reduced from 6 plates to 4
          <group key={i} rotation={[0, (i * Math.PI) / 2, 0]}>
            <mesh position={[0.11, 0, 0]} rotation={[0, Math.PI / 6, 0]}>
              <boxGeometry args={[0.12, 0.19, 0.02]} />
              <meshStandardMaterial
                color="#d4d4d4"
                roughness={0.5}
                metalness={0.4}
                emissive="#330000"
                emissiveIntensity={0.2}
              />
            </mesh>

            {/* Decorative ridge on each plate */}
            <mesh position={[0.07, 0.05, 0.0]} rotation={[0, Math.PI / 6, 0]}>
              <boxGeometry args={[0.035, 0.24, 0.015]} />
              <meshStandardMaterial
                color="#c0c0c0"
                roughness={0.3}
                metalness={0.5}
                emissive="#220000"
                emissiveIntensity={0.15}
              />
            </mesh>
          </group>
        ))}

        {/* Top rim */}
        <mesh position={[0, 0.22, 0]} rotation={[Math.PI/2, Math.PI, Math.PI/2]}>
          <torusGeometry args={[0.065, 0.02, 3, 5]} />
          <meshStandardMaterial
            color="#d4d4d4"
            roughness={0.3}
            metalness={0.5}
            emissive="#330000"
            emissiveIntensity={0.2}
          />
        </mesh>

                {/* bottom rim */}
                <mesh position={[0, 0, 0]} rotation={[Math.PI/2, Math.PI, Math.PI/2]}>
          <torusGeometry args={[0.16, 0.02, 4, 5]} />
          <meshStandardMaterial
            color="#d4d4d4"
            roughness={0.3}
            metalness={0.5}
            emissive="#330000"
            emissiveIntensity={0.2}
          />
        </mesh>
                {/* bottom rim */}
                <mesh position={[0, -0.10, 0]} rotation={[Math.PI/2, Math.PI, Math.PI/2]}>
          <torusGeometry args={[0.20, 0.02, 4, 5]} />
          <meshStandardMaterial
            color="#d4d4d4"
            roughness={0.3}
            metalness={0.5}
            emissive="#330000"
            emissiveIntensity={0.2}
          />
        </mesh>


        {/* h0ver rim */}
        <mesh position={[0, 0.10, 0]} rotation={[Math.PI/2, Math.PI, Math.PI/2]}>
          <torusGeometry args={[0.125, 0.0175, 6, 6]} />
          <meshStandardMaterial
            color="#d4d4d4"
            roughness={0.3}
            metalness={0.5}
            emissive="#330000"
            emissiveIntensity={0.2}
          />
        </mesh>
      </group>
    </group>
  );
}

export default function CustomSkeleton({ position, rotation = [0, 0, 0] }: CustomSkeletonProps) {
  const groupRef = useRef<Group>(null);

  // Update rotation when it changes
  React.useEffect(() => {
    if (groupRef.current) {
      groupRef.current.rotation.set(rotation[0], rotation[1], rotation[2]);
    }
  }, [rotation]);

  return (
    <>
      <group ref={groupRef} position={[position[0], position[1] + 1, position[2]]} rotation={rotation} scale={[0.8, 0.8, 0.8]}>

        <group name="Body" position={[0, 1, 0.085]} scale={[0.85, 0.85, 0.85]} rotation={[0.1, 0, 0]}>
          <BonePlate />
        </group>


      {/* SKULL POSITIONING - adjusted for hunched posture */}
      <group name="Head" position={[0, 1.575, 0.35]} scale={[ 0.75, 0.8, 0.8]} rotation={[0.15, 0, 0]}>
        {/* Main skull shape */}
        <group>
          {/* Back of cranium */}
          <mesh position={[0, 0, -0.05]}>
            <sphereGeometry args={[0.22, 8, 8]} />
            <meshStandardMaterial color="#d8e8d8" roughness={0.4} metalness={0.3} />
          </mesh>

          {/* Front face plate */}
          <mesh position={[0, -0.02, 0.12]}>
            <boxGeometry args={[0.28, 0.28, 0.1]} />
            <meshStandardMaterial color="#d8e8d8" roughness={0.4} metalness={0.3} />
          </mesh>

          {/* Cheekbones */}
          <group>
            <mesh position={[0.12, -0.08, 0.1]}>
              <boxGeometry args={[0.08, 0.12, 0.15]} />
              <meshStandardMaterial color="#d8e8d8" roughness={0.4} metalness={0.3} />
            </mesh>
            <mesh position={[-0.12, -0.08, 0.1]}>
              <boxGeometry args={[0.08, 0.12, 0.15]} />
              <meshStandardMaterial color="#d8e8d8" roughness={0.4} metalness={0.3} />
            </mesh>
          </group>

          {/* Jaw structure */}
          <group position={[0, -0.15, 0.05]}>


            {/* Lower jaw - more angular and pointed */}
            <mesh position={[0, -0.08, 0.08]} rotation={[0, Math.PI/5, 0]}>
              <cylinderGeometry args={[0.08, 0.08, 0.2, 5]} />
              <meshStandardMaterial color="#d8d8d8" roughness={0.5} metalness={0.2} />
            </mesh>
          </group>

          {/* Upper teeth row */}
          <group position={[0.025, -0.25, 0.2175]} >
            {[-0.03, -0.06, -0.09, -0, 0.03].map((offset, i) => (
              <group key={i} position={[offset, 0, 0]} rotation={[0.5, 0, 0]}>
                <mesh>
                  <coneGeometry args={[0.03, 0.075, 3]} />
                  <meshStandardMaterial
                    color="#e8e8e8"
                    roughness={0.3}
                    metalness={0.4}
                  />
                </mesh>
              </group>
            ))}
          </group>

          {/* Lower teeth row */}
          <group position={[0, -0.18, 0.2]}>
            {[-0.06, -0.02, 0.02, 0.06].map((offset, i) => (
              <group key={i} position={[offset, 0, 0]} rotation={[2.5, 0, 0]}>
                <mesh>
                  <coneGeometry args={[0.01, 0.08, 3]} />
                  <meshStandardMaterial
                    color="#e8e8e8"
                    roughness={0.3}
                    metalness={0.4}
                  />
                </mesh>
              </group>
            ))}
          </group>
        </group>

        {/* EYES============================= */}

        {/* Eye sockets with bright green glow effect */}
        <group position={[0, 0.05, 0.14]}>
          {/* Left eye */}
          <group position={[-0.07, 0, 0]}>
            {/* Core eye */}
            <mesh>
              <sphereGeometry args={[0.02, 8, 8]} />
              <meshStandardMaterial color="#00FF00" emissive="#00FF00" emissiveIntensity={3} />
            </mesh>
            {/* Inner glow */}
            <mesh scale={1.2}>
              <sphereGeometry args={[0.035, 8, 8]} />
              <meshStandardMaterial
                color="#00FF00"
                emissive="#440000"
                emissiveIntensity={1}
                transparent
                opacity={0.75}
              />
            </mesh>
            {/* Outer glow */}
            <mesh scale={1.4}>
              <sphereGeometry args={[0.05, 6.5, 2]} />
              <meshStandardMaterial
                color="#440000"
                emissive="#00FF00"
                emissiveIntensity={1}
                transparent
                opacity={0.7}
              />
            </mesh>
            {/* Point light for dynamic glow */}
            <pointLight
              color="#440000"
              intensity={2.5}
              distance={1}
              decay={1}
            />
          </group>



          {/* Right eye */}
          <group position={[0.07, 0, 0]}>
            {/* Core eye */}
            <mesh>
              <sphereGeometry args={[0.02, 8, 8]} />
              <meshStandardMaterial color="#00FF00" emissive="#00FF00" emissiveIntensity={3} />
            </mesh>
            {/* Inner glow */}
            <mesh scale={1.2}>
              <sphereGeometry args={[0.035, 8, 8]} />
              <meshStandardMaterial
                color="#00FF00"
                emissive="#00FF00"
                emissiveIntensity={1}
                transparent
                opacity={0.75}
              />
            </mesh>
            {/* Outer glow */}
            <mesh scale={1.4}>
              <sphereGeometry args={[0.05, 6.5, 2]} />
              <meshStandardMaterial
                color="#00FF00"
                emissive="#00FF00"
                emissiveIntensity={1}
                transparent
                opacity={0.7}
              />
            </mesh>
            {/* Point light for dynamic glow */}
            <pointLight
              color="#440000"
              intensity={2.5}
              distance={1}
              decay={1}
            />
          </group>
        </group>
      </group>

      {/* Add shoulder plates just before the arms - adjusted for hunched posture */}
      <group position={[-0.375, 1.35, 0.22]} rotation={[0, -Math.PI + 0.4, -0.425]}>
        <ShoulderPlate />
      </group>
      <group position={[0.375, 1.35, 0.22]} rotation={[0, Math.PI -0.4, 0.425]}>
        <ShoulderPlate />
      </group>

      {/* arms with scaled boss claws - adjusted for hunched posture */}
      <group name="LeftArm" position={[-0.35, 1, 0.18]} scale={[-0.45, 0.45, 0.45]} rotation={[0.1, Math.PI/5, 0.15]}>
        <BossClawModel isLeftHand={true} />
      </group>
      <group name="RightArm" position={[0.35, 1, 0.18]} scale={[0.45, 0.45, 0.45]} rotation={[0.1, -Math.PI/5, -0.15]}>
        <BossClawModel isLeftHand={false} />
      </group>

      {/* Pelvis structure */}
      <group position={[0, 0.45, 0]} scale={[1.4, 0.825, 0.8]}>
        {/* Main pelvic bowl */}
        <mesh>
          <cylinderGeometry args={[0.21, 0.10, 0.3, 8]} />
          <meshStandardMaterial color="#c4d4c4" roughness={0.5} metalness={0.2} emissive="#220000" emissiveIntensity={0.15} />
        </mesh>




        {/* Pelvic joints */}
        {[-1, 1].map((side) => (
          <group key={side} position={[0.15 * side, -0.1, 0]}>
            <mesh>
              <sphereGeometry args={[0.075, 8, 8]} />
              <meshStandardMaterial color="#c4d4c4" roughness={0.5} metalness={0.2} emissive="#220000" emissiveIntensity={0.15} />
            </mesh>
          </group>
        ))}
      </group>

      {/* Legs - tilted slightly like Death Knight for hunched stance */}
      <group name="LeftLeg" position={[0.2, 0, -0.05]} rotation={[0.04, -0.04, 0]}>
        <BoneLegModel />
      </group>
      <group name="RightLeg" position={[-0.2, 0, -0.05]} rotation={[0.04, 0.04, 0]}>
        <BoneLegModel />
      </group>

        {/* Neck connection - adjusted for hunched posture */}
        <group position={[0, 1.25, 0.18]} rotation={[0.2, 0, 0]}>
          <mesh>
            <cylinderGeometry args={[0.04, 0.04, 0.2, 6]} />
            <meshStandardMaterial color="#d8e8d8" roughness={0.4} metalness={0.3} emissive="#330000" emissiveIntensity={0.2} />
          </mesh>
        </group>
      </group>

    </>
  );
}
