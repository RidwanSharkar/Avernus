import React, { useRef, useEffect, useMemo, useState } from 'react';
import { BufferGeometry, CylinderGeometry, MeshStandardMaterial, Group, Mesh, Vector3, Quaternion, Color, InstancedMesh, Matrix4, PerspectiveCamera, ConeGeometry } from '../../utils/three-exports';
import { useFrame, useThree } from '@react-three/fiber';


// Function to create foliage cone geometry (deterministic based on position)
const createFoliageCone = (position: Vector3, scale: number = 1): ConeGeometry => {
  // Use position-based pseudo-random values for consistency
  const seed = Math.abs(position.x * 100 + position.y * 50 + position.z * 25);
  const pseudoRandom = (s: number) => Math.sin(s) * 0.5 + 0.5;

  const coneRadius = 0.3 + pseudoRandom(seed) * 0.4; // 0.3-0.7 radius
  const coneHeight = 0.6 + pseudoRandom(seed + 1) * 0.8; // 0.6-1.4 height

  return new ConeGeometry(
    coneRadius * scale,
    coneHeight * scale,
    8, // 8 segments for natural look
    1  // 1 height segment
  );
};

interface TreeBranch {
  start: Vector3;
  end: Vector3;
  radius: number;
  children: TreeBranch[];
  rotation: Vector3;
  hasFoliage?: boolean; // Whether this branch should have foliage
}

export interface DetailedTree {
  position: Vector3;
  scale: number;
  height: number;
  trunkRadius: number;
  trunkColor: Color;
}

interface DetailedTreesProps {
  trees: DetailedTree[];
  camera?: PerspectiveCamera;
  lodDistances?: {
    high: number;    // Full detail trees (default 35)
    medium: number;  // Reduced detail trees (default 75)
    low: number;     // Minimal detail trees (default 150)
  };
}

// Function to generate a natural tree structure with LOD support
const generateTreeStructure = (lod: 'high' | 'medium' | 'low' = 'high'): TreeBranch[] => {
  const trunkHeight = 3 + Math.random() * 2; // 3-5 units tall
  const trunkRadius = 0.15 + Math.random() * 0.1; // 0.15-0.25 radius

  // Determine tree type for variety
  const treeType = Math.random();
  let isSparse = false;
  let isDense = false;

  if (treeType < 0.3) {
    isSparse = true; // 30% chance for sparse trees
  } else if (treeType > 0.7) {
    isDense = true; // 30% chance for dense trees
  }
  // 40% chance for normal trees

  // Create main trunk with slight natural curve
  const trunkCurve = (Math.random() - 0.5) * 0.3; // Slight trunk curve
  const trunk: TreeBranch = {
    start: new Vector3(0, 0, 0),
    end: new Vector3(trunkCurve, trunkHeight, 0),
    radius: trunkRadius,
    children: [],
    rotation: new Vector3(0, 0, 0)
  };

  // Generate main branches from trunk (LOD-dependent)
  let mainBranchCount = 4 + Math.floor(Math.random() * 4); // 4-7 main branches (increased)
  if (isSparse) mainBranchCount = Math.max(3, mainBranchCount - 2); // Fewer branches for sparse trees
  if (isDense) mainBranchCount = mainBranchCount + 3; // More branches for dense trees

  // Reduce branch count for lower LOD levels
  if (lod === 'medium') mainBranchCount = Math.max(2, Math.floor(mainBranchCount * 0.6));
  if (lod === 'low') mainBranchCount = Math.max(1, Math.floor(mainBranchCount * 0.3));

  const branchStartHeight = trunkHeight * (0.5 + Math.random() * 0.2); // Start branching at 50-70% of trunk height

  for (let i = 0; i < mainBranchCount; i++) {
    const angle = (i / mainBranchCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.8;
    const height = branchStartHeight + (Math.random() - 0.5) * trunkHeight * 0.4;
    const length = 1.2 + Math.random() * 1.8; // 1.2-3 units long
    const radius = trunkRadius * (0.5 + Math.random() * 0.5); // 50-100% of trunk radius

    // Natural upward-growing branches
    const upwardAngle = Math.PI * 0.15 + Math.random() * Math.PI * 0.25; // 15-40 degrees upward
    const horizontalSpread = 0.4 + Math.random() * 0.3; // Reduced horizontal spread (0.4-0.7)
    const verticalGrowth = Math.cos(upwardAngle) * length; // Strong vertical component
    const horizontalGrowth = Math.sin(upwardAngle) * length * horizontalSpread;

    const branch: TreeBranch = {
      start: new Vector3(0, height, 0),
      end: new Vector3(
        Math.cos(angle) * horizontalGrowth,
        height + verticalGrowth, // Strong upward growth
        Math.sin(angle) * horizontalGrowth
      ),
      radius: radius,
      children: [],
      rotation: new Vector3(
        (Math.random() - 0.5) * 0.3, // Less rotation variation
        angle + (Math.random() - 0.5) * 0.2,
        (Math.random() - 0.5) * 0.3
      )
    };

    // Generate secondary branches (LOD-dependent)
    let secondaryCount = 3 + Math.floor(Math.random() * 4); // 3-6 secondary branches (increased)
    if (lod === 'medium') secondaryCount = Math.max(1, Math.floor(secondaryCount * 0.5));
    if (lod === 'low') secondaryCount = 0; // No secondary branches for low LOD
    for (let j = 0; j < secondaryCount; j++) {
      const secAngle = angle + (Math.random() - 0.5) * 2.0;
      const secLength = length * (0.3 + Math.random() * 0.5); // 30-80% of main branch
      const secRadius = radius * (0.4 + Math.random() * 0.4); // 40-80% of main branch radius

      // Secondary branches also grow upward but at steeper angles
      const secUpwardAngle = Math.PI * 0.2 + Math.random() * Math.PI * 0.3; // 20-50 degrees upward
      const secHorizontalSpread = 0.3 + Math.random() * 0.4; // Even less horizontal spread
      const secVerticalGrowth = Math.cos(secUpwardAngle) * secLength;
      const secHorizontalGrowth = Math.sin(secUpwardAngle) * secLength * secHorizontalSpread;

      const secondaryBranch: TreeBranch = {
        start: branch.end.clone(),
        end: new Vector3(
          branch.end.x + Math.cos(secAngle) * secHorizontalGrowth,
          branch.end.y + secVerticalGrowth, // Strong upward growth
          branch.end.z + Math.sin(secAngle) * secHorizontalGrowth
        ),
        radius: secRadius,
        children: [],
        rotation: new Vector3(
          (Math.random() - 0.5) * 0.4,
          secAngle + (Math.random() - 0.5) * 0.3,
          (Math.random() - 0.5) * 0.4
        )
      };

      // Removed tertiary branches to prevent cactus-like appearance

      branch.children.push(secondaryBranch);
    }

    trunk.children.push(branch);
  }

  return [trunk];
};

// Function to create branch geometry
const createBranchGeometry = (branch: TreeBranch, isTerminal: boolean = false): BufferGeometry => {
  const direction = branch.end.clone().sub(branch.start);
  const length = direction.length();

  // For terminal branches, taper to a point (cone-like ending)
  // For non-terminal branches, use normal cylinder geometry
  const topRadius = isTerminal ? 0 : branch.radius * 0.8; // Taper to point if terminal
  const bottomRadius = branch.radius;

  // Create a cylinder (or cone if terminal) for the branch
  const geometry = new CylinderGeometry(
    topRadius,     // Top radius (0 for terminal branches, smaller for others)
    bottomRadius,  // Bottom radius
    length,
    6              // 6 segments for natural look
  );

  // Position cylinder so it starts at origin and extends along Y-axis
  geometry.translate(0, length / 2, 0);

  return geometry;
};

const DetailedTrees: React.FC<DetailedTreesProps> = ({
  trees,
  camera,
  lodDistances = { high: 35, medium: 75, low: 150 }
}) => {
  const treeGroupsRef = useRef<Group[]>([]);
  const [treeLODs, setTreeLODs] = useState<Map<number, 'high' | 'medium' | 'low'>>(new Map());
  const lastLODUpdate = useRef(0);

  // Generate tree structures with LOD support
  const treeStructures = useMemo(() => {
    return trees.map((tree, index) => {
      const lod = treeLODs.get(index) || 'high';
      return {
        ...tree,
        branches: generateTreeStructure(lod)
      };
    });
  }, [trees, treeLODs]);

  useEffect(() => {
    // Clear previous trees
    treeGroupsRef.current.forEach(group => {
      if (group.parent) {
        group.parent.remove(group);
      }
      // Dispose all geometries and materials in the group
      group.traverse((child) => {
        if (child instanceof Mesh) {
          if (child.geometry) {
            child.geometry.dispose();
          }
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach(material => material.dispose());
            } else {
              child.material.dispose();
            }
          }
        }
      });
    });
    treeGroupsRef.current = [];

    // Create new trees
    treeStructures.forEach((tree) => {
      const treeGroup = new Group();

      // Create trunk
      const trunkGeometry = new CylinderGeometry(
        tree.trunkRadius * 0.8,
        tree.trunkRadius,
        tree.height,
        8
      );

      // Create more realistic bark material with color variation
      const barkColorVariation = 0.2; // 20% color variation
      const trunkColorWithVariation = tree.trunkColor.clone().multiplyScalar(
        1.0 + Math.random() * barkColorVariation // Keep trunk at full brightness (was 0.9)
      );

      const trunkMaterial = new MeshStandardMaterial({
        color: trunkColorWithVariation,
        roughness: 0.85 + Math.random() * 0.1, // 0.85-0.95 for bark texture
        metalness: 0.05 + Math.random() * 0.05, // 0.05-0.1 for subtle variation
        emissive: trunkColorWithVariation.clone().multiplyScalar(0.05),
        emissiveIntensity: 0.15 + Math.random() * 0.1
      });

      const trunkMesh = new Mesh(trunkGeometry, trunkMaterial);
      trunkMesh.position.y = tree.height / 2;
      treeGroup.add(trunkMesh);

      // Create branches recursively
      const createBranches = (branches: TreeBranch[], parentGroup: Group) => {
        branches.forEach(branch => {
          const branchGeometry = createBranchGeometry(branch);

          // Create branch material with color variation based on branch size
          const branchColorVariation = 0.2; // 20% color variation for branches
          const branchColor = tree.trunkColor.clone().multiplyScalar(
            0.85 + Math.random() * branchColorVariation // Branches slightly darker than trunk (was 0.7)
          );

          const branchMaterial = new MeshStandardMaterial({
            color: branchColor,
            roughness: 0.9 + Math.random() * 0.08, // 0.9-0.98 for branch texture
            metalness: 0.02 + Math.random() * 0.03, // 0.02-0.05 for subtle variation
            emissive: branchColor.clone().multiplyScalar(0.03),
            emissiveIntensity: 0.08 + Math.random() * 0.07
          });

          const branchMesh = new Mesh(branchGeometry, branchMaterial);

          // Position branch at start point
          branchMesh.position.copy(branch.start);

          // Calculate direction and rotation to align branch properly
          const direction = branch.end.clone().sub(branch.start).normalize();
          const up = new Vector3(0, 1, 0);

          // Create quaternion to rotate from up vector to branch direction
          const quaternion = new Quaternion();
          quaternion.setFromUnitVectors(up, direction);
          branchMesh.setRotationFromQuaternion(quaternion);

          parentGroup.add(branchMesh);

          // Removed twigs to simplify tree structure and prevent cactus-like appearance

          // Recursively add child branches
          if (branch.children.length > 0) {
            createBranches(branch.children, parentGroup);
          }
        });
      };

      createBranches(tree.branches, treeGroup);

      // Position the entire tree
      treeGroup.position.copy(tree.position);
      treeGroup.scale.setScalar(tree.scale);

      // Add some random rotation for variety
      treeGroup.rotation.y = Math.random() * Math.PI * 2;

      // Add slight random tilt for more natural look
      treeGroup.rotation.x = (Math.random() - 0.5) * 0.1;
      treeGroup.rotation.z = (Math.random() - 0.5) * 0.1;

      // Add some random position variation for more natural clustering
      const positionVariation = 0.5;
      treeGroup.position.x += (Math.random() - 0.5) * positionVariation;
      treeGroup.position.z += (Math.random() - 0.5) * positionVariation;

      treeGroupsRef.current.push(treeGroup);
    });
  }, [treeStructures]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Dispose all remaining tree groups
      treeGroupsRef.current.forEach(group => {
        group.traverse((child) => {
          if (child instanceof Mesh) {
            if (child.geometry) {
              child.geometry.dispose();
            }
            if (child.material) {
              if (Array.isArray(child.material)) {
                child.material.forEach(material => material.dispose());
              } else {
                child.material.dispose();
              }
            }
          }
        });
      });
      treeGroupsRef.current = [];
    };
  }, []);

  // Update LOD levels based on camera distance
  useFrame(() => {
    if (!camera || !(camera as PerspectiveCamera).isPerspectiveCamera) return;

    const perspectiveCamera = camera as PerspectiveCamera;
    const currentTime = Date.now();

    // Throttle LOD updates to every 2 seconds to avoid excessive calculations
    if (currentTime - lastLODUpdate.current < 2000) return;
    lastLODUpdate.current = currentTime;

    const newLODs = new Map<number, 'high' | 'medium' | 'low'>();

    trees.forEach((tree, index) => {
      const distance = perspectiveCamera.position.distanceTo(tree.position);
      let newLod: 'high' | 'medium' | 'low';

      if (distance < lodDistances.high) {
        newLod = 'high';
      } else if (distance < lodDistances.medium) {
        newLod = 'medium';
      } else {
        newLod = 'low';
      }

      newLODs.set(index, newLod);
    });

    setTreeLODs(newLODs);
  });

  return (
    <group>
      {treeGroupsRef.current.map((treeGroup, index) => (
        <primitive key={index} object={treeGroup} />
      ))}
    </group>
  );
};

// Large Tree Component for memory-efficient large trees
interface LargeTreeProps {
  position: Vector3;
  scale: number;
  trunkColor: Color;
  camera?: PerspectiveCamera;
}

export const LargeTree: React.FC<LargeTreeProps> = ({ position, scale, trunkColor, camera }) => {
  const treeGroupRef = useRef<Group>(null);
  const branchInstancesRef = useRef<InstancedMesh[]>([]);
  const [lodLevel, setLodLevel] = useState<'high' | 'medium' | 'low'>('high');
  const previousLodLevel = useRef<'high' | 'medium' | 'low'>('high');

  // Generate stable random rotation based on position for consistency
  const stableRotation = useMemo(() => ({
    y: Math.sin(position.x * 0.01 + position.z * 0.007) * 0.3, // Subtle variation
    x: (Math.cos(position.x * 0.005) - 0.5) * 0.02,
    z: (Math.sin(position.z * 0.008) - 0.5) * 0.02
  }), [position]);

  // Calculate LOD based on distance from camera (with hysteresis to reduce flickering)
  useEffect(() => {
    if (!camera || !(camera as PerspectiveCamera).isPerspectiveCamera) return;

    const perspectiveCamera = camera as PerspectiveCamera;
    const updateLOD = () => {
      const distance = perspectiveCamera.position.distanceTo(position);
      let newLodLevel: 'high' | 'medium' | 'low';

      // Add hysteresis to prevent rapid switching
      if (distance < 45) { // High threshold (was 50)
        newLodLevel = 'high';
      } else if (distance < 160) { // Medium threshold with buffer (was 150)
        newLodLevel = 'medium';
      } else {
        newLodLevel = 'low';
      }

      // Only update if LOD level actually changed
      if (newLodLevel !== previousLodLevel.current) {
        previousLodLevel.current = newLodLevel;
        setLodLevel(newLodLevel);
      }
    };

    updateLOD();
    const interval = setInterval(updateLOD, 3000); // Update LOD every 3 seconds (reduced frequency)

    return () => clearInterval(interval);
  }, [camera, position]);

  // Generate optimized tree structure for large trees (deterministic based on position)
  const treeStructure = useMemo(() => {
    // Use position-based pseudo-random values for consistency
    const seed = position.x * 1000 + position.z * 100;
    const pseudoRandom = (s: number) => Math.sin(s) * 0.5 + 0.5; // 0-1 range

    const height = 8 + pseudoRandom(seed) * 4; // 8-12 units tall
    const trunkRadius = 0.8 + pseudoRandom(seed + 1) * 0.4; // 0.8-1.2 radius

    const trunk = {
      start: new Vector3(0, 0, 0),
      end: new Vector3(0, height, 0),
      radius: trunkRadius
    };

    // Fewer but thicker branches for large trees
    const branches = [];
    const mainBranchCount = lodLevel === 'high' ? 8 : lodLevel === 'medium' ? 6 : 4;

    for (let i = 0; i < mainBranchCount; i++) {
      const branchSeed = seed + i * 10;
      const angle = (i / mainBranchCount) * Math.PI * 2 + (pseudoRandom(branchSeed + 2) - 0.5) * 0.5;
      const heightVariation = height * (0.6 + pseudoRandom(branchSeed + 3) * 0.3);
      const length = 3 + pseudoRandom(branchSeed + 4) * 2;
      const radius = trunkRadius * (0.4 + pseudoRandom(branchSeed + 5) * 0.3);

      const branchStart = new Vector3(0, heightVariation, 0);
      const branchEnd = new Vector3(
        Math.cos(angle) * length * 0.6,
        heightVariation + length * 0.8,
        Math.sin(angle) * length * 0.6
      );

      // Create secondary branches (children of primary branches)
      const secondaryBranches: TreeBranch[] = [];
      const secondaryCount = 2 + Math.floor(pseudoRandom(branchSeed + 6) * 3); // 2-4 secondary branches

      for (let j = 0; j < secondaryCount; j++) {
        const secSeed = branchSeed + j * 5 + 100;
        const secAngle = angle + (pseudoRandom(secSeed) - 0.5) * 1.5;
        const secLength = length * (0.4 + pseudoRandom(secSeed + 1) * 0.4);
        const secRadius = radius * (0.5 + pseudoRandom(secSeed + 2) * 0.3);

        const secStart = branchEnd.clone();
        const secEnd = new Vector3(
          secStart.x + Math.cos(secAngle) * secLength * 0.7,
          secStart.y + secLength * 0.8,
          secStart.z + Math.sin(secAngle) * secLength * 0.7
        );

        // Create tertiary branches (grandchildren)
        const tertiaryBranches: TreeBranch[] = [];
        const tertiaryCount = 1 + Math.floor(pseudoRandom(secSeed + 3) * 2); // 1-2 tertiary branches

        for (let k = 0; k < tertiaryCount; k++) {
          const tertSeed = secSeed + k * 3 + 200;
          const tertAngle = secAngle + (pseudoRandom(tertSeed) - 0.5) * 1.0;
          const tertLength = secLength * (0.3 + pseudoRandom(tertSeed + 1) * 0.4);
          const tertRadius = secRadius * (0.6 + pseudoRandom(tertSeed + 2) * 0.3);

          const tertStart = secEnd.clone();
          const tertEnd = new Vector3(
            tertStart.x + Math.cos(tertAngle) * tertLength * 0.8,
            tertStart.y + tertLength * 0.9,
            tertStart.z + Math.sin(tertAngle) * tertLength * 0.8
          );

          const tertiaryBranch: TreeBranch = {
            start: tertStart,
            end: tertEnd,
            radius: tertRadius,
            children: [],
            rotation: new Vector3(
              (pseudoRandom(tertSeed + 3) - 0.5) * 0.3,
              tertAngle,
              (pseudoRandom(tertSeed + 4) - 0.5) * 0.3
            ),
            hasFoliage: true // Terminal branches get foliage
          };

          tertiaryBranches.push(tertiaryBranch);
        }

        const secondaryBranch: TreeBranch = {
          start: secStart,
          end: secEnd,
          radius: secRadius,
          children: tertiaryBranches,
          rotation: new Vector3(
            (pseudoRandom(secSeed + 3) - 0.5) * 0.2,
            secAngle,
            (pseudoRandom(secSeed + 4) - 0.5) * 0.2
          ),
          hasFoliage: tertiaryBranches.length === 0 // Only add foliage if no children
        };

        secondaryBranches.push(secondaryBranch);
      }

      const branch: TreeBranch = {
        start: branchStart,
        end: branchEnd,
        radius: radius,
        children: secondaryBranches,
        rotation: new Vector3(
          (pseudoRandom(branchSeed + 6) - 0.5) * 0.2,
          angle,
          (pseudoRandom(branchSeed + 7) - 0.5) * 0.2
        ),
        hasFoliage: false // Primary branches don't get direct foliage
      };

      branches.push(branch);
    }

    return { trunk, branches };
  }, [lodLevel, position]);

  useEffect(() => {
    if (!treeGroupRef.current) return;

    // Clear previous instances
    branchInstancesRef.current.forEach(instance => {
      if (instance.parent) {
        instance.parent.remove(instance);
      }
    });
    branchInstancesRef.current = [];

    const group = treeGroupRef.current;

    // Create trunk
    const trunkGeometry = new CylinderGeometry(
      treeStructure.trunk.radius * 0.8,
      treeStructure.trunk.radius,
      treeStructure.trunk.end.y,
      lodLevel === 'high' ? 12 : 8
    );

    const trunkMaterial = new MeshStandardMaterial({
      color: trunkColor,
      roughness: 0.9,
      metalness: 0.1
    });

    const trunkMesh = new Mesh(trunkGeometry, trunkMaterial);
    trunkMesh.position.y = treeStructure.trunk.end.y / 2;
    group.add(trunkMesh);

    // Create all branches recursively with foliage
    const renderBranches = (branches: TreeBranch[], parentGroup: Group) => {
      if (branches.length === 0) return;

      // Collect all branches for instanced rendering
      const allBranches: TreeBranch[] = [];
      const collectBranches = (branchList: TreeBranch[]) => {
        branchList.forEach(branch => {
          allBranches.push(branch);
          if (branch.children && branch.children.length > 0) {
            collectBranches(branch.children);
          }
        });
      };
      collectBranches(branches);

      if (allBranches.length > 0) {
        // Create branch geometry (shared for all branches)
        const maxLength = Math.max(...allBranches.map(b => b.end.distanceTo(b.start)));
        const maxRadius = Math.max(...allBranches.map(b => b.radius));

        const branchGeometry = new CylinderGeometry(
          maxRadius * 0.7, // Tapered top
          maxRadius,
          maxLength,
          lodLevel === 'high' ? 8 : 6
        );

        // Position geometry so it starts at origin
        branchGeometry.translate(0, maxLength / 2, 0);

        const branchMaterial = new MeshStandardMaterial({
          color: trunkColor.clone().multiplyScalar(0.9),
          roughness: 0.95,
          metalness: 0.05
        });

        // Create instanced mesh for all branches
        const instancedBranches = new InstancedMesh(
          branchGeometry,
          branchMaterial,
          allBranches.length
        );

        // Set up each branch instance
        const matrix = new Matrix4();
        const tempQuaternion = new Quaternion();

        allBranches.forEach((branch, index) => {
          const direction = branch.end.clone().sub(branch.start).normalize();
          const length = branch.end.distanceTo(branch.start);

          // Scale the matrix based on actual branch length
          matrix.makeScale(1, length / maxLength, 1);

          // Position at branch start
          matrix.setPosition(branch.start);

          // Rotate to align with branch direction
          tempQuaternion.setFromUnitVectors(new Vector3(0, 1, 0), direction);
          matrix.multiply(new Matrix4().makeRotationFromQuaternion(tempQuaternion));

          instancedBranches.setMatrixAt(index, matrix);
        });

        // Update branch geometry to use terminal tapering for branches with foliage
        const terminalBranches = allBranches.filter(b => b.hasFoliage);
        if (terminalBranches.length > 0) {
          // Create separate geometry for terminal branches with tapering
          const terminalGeometry = new CylinderGeometry(
            0, // Top radius (0 for terminal branches - cone shape)
            maxRadius,
            maxLength,
            lodLevel === 'high' ? 8 : 6
          );
          terminalGeometry.translate(0, maxLength / 2, 0);

          // Create instanced mesh for terminal branches
          const terminalInstanced = new InstancedMesh(
            terminalGeometry,
            branchMaterial,
            terminalBranches.length
          );

          terminalBranches.forEach((branch, index) => {
            const direction = branch.end.clone().sub(branch.start).normalize();
            const length = branch.end.distanceTo(branch.start);

            matrix.makeScale(1, length / maxLength, 1);
            matrix.setPosition(branch.start);
            tempQuaternion.setFromUnitVectors(new Vector3(0, 1, 0), direction);
            matrix.multiply(new Matrix4().makeRotationFromQuaternion(tempQuaternion));

            terminalInstanced.setMatrixAt(index, matrix);
          });

          parentGroup.add(terminalInstanced);
          branchInstancesRef.current.push(terminalInstanced);

          // Remove terminal branches from main instanced mesh
          const nonTerminalBranches = allBranches.filter(b => !b.hasFoliage);
          if (nonTerminalBranches.length !== allBranches.length) {
            // Update main instanced mesh to exclude terminal branches
            const updatedInstanced = new InstancedMesh(
              branchGeometry,
              branchMaterial,
              nonTerminalBranches.length
            );

            nonTerminalBranches.forEach((branch, index) => {
              const direction = branch.end.clone().sub(branch.start).normalize();
              const length = branch.end.distanceTo(branch.start);

              matrix.makeScale(1, length / maxLength, 1);
              matrix.setPosition(branch.start);
              tempQuaternion.setFromUnitVectors(new Vector3(0, 1, 0), direction);
              matrix.multiply(new Matrix4().makeRotationFromQuaternion(tempQuaternion));

              updatedInstanced.setMatrixAt(index, matrix);
            });

            parentGroup.remove(instancedBranches);
            parentGroup.add(updatedInstanced);
            branchInstancesRef.current[branchInstancesRef.current.indexOf(instancedBranches)] = updatedInstanced;
          }
        }

        parentGroup.add(instancedBranches);
        branchInstancesRef.current.push(instancedBranches);
      }
    };

    // Render all branches starting from primary branches
    renderBranches(treeStructure.branches, group);

    // Add foliage to terminal branches
    const addFoliageToBranches = (branches: TreeBranch[], parentGroup: Group) => {
      branches.forEach(branch => {
        // Add foliage to this branch if it should have it
        if (branch.hasFoliage) {
          const foliageGeometry = createFoliageCone(branch.end, 1.0);
          const foliageMaterial = new MeshStandardMaterial({
            color: new Color(0x2d5a1a), // Dark green foliage
            roughness: 0.8,
            metalness: 0.0
          });

          const foliageMesh = new Mesh(foliageGeometry, foliageMaterial);
          foliageMesh.position.copy(branch.end);
          // Position foliage slightly above the branch end
          foliageMesh.position.y += 0.1;
          parentGroup.add(foliageMesh);
        }

        // Recursively add foliage to children
        if (branch.children && branch.children.length > 0) {
          addFoliageToBranches(branch.children, parentGroup);
        }
      });
    };

    addFoliageToBranches(treeStructure.branches, group);

    // Position and scale the entire tree
    group.position.copy(position);
    group.scale.setScalar(scale);

    // Apply stable rotation for natural variation (consistent per tree position)
    group.rotation.y = stableRotation.y;
    group.rotation.x = stableRotation.x;
    group.rotation.z = stableRotation.z;

  }, [treeStructure, position, scale, trunkColor, lodLevel, stableRotation]);

  return <primitive ref={treeGroupRef} object={new Group()} />;
};

// Optimized Large Tree with Billboard fallback for distant rendering
export const OptimizedLargeTree: React.FC<LargeTreeProps> = ({ position, scale, trunkColor, camera }) => {
  const [distance, setDistance] = useState(0);

  useEffect(() => {
    if (!camera || !(camera as PerspectiveCamera).isPerspectiveCamera) return;

    const perspectiveCamera = camera as PerspectiveCamera;
    const updateDistance = () => {
      const newDistance = perspectiveCamera.position.distanceTo(position);
      // Only update if distance changed significantly (by at least 20 units)
      if (Math.abs(newDistance - distance) > 20) {
        setDistance(newDistance);
      }
    };

    updateDistance();
    const interval = setInterval(updateDistance, 4000); // Update every 4 seconds (less frequent)

    return () => clearInterval(interval);
  }, [camera, position, distance]);

  // Use billboard for very distant trees (ultra memory efficient)
  if (distance > 200) {
    return (
      <mesh position={position} scale={scale * 2}>
        <planeGeometry args={[4, 8]} />
        <meshBasicMaterial
          color={trunkColor.clone().multiplyScalar(0.8)}
          transparent
          alphaTest={0.5}
        />
      </mesh>
    );
  }

  // Use optimized 3D tree for closer distances
  return <LargeTree position={position} scale={scale} trunkColor={trunkColor} camera={camera} />;
};

export default DetailedTrees;
