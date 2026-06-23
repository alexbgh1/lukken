import {
  Component,
  ElementRef,
  AfterViewInit,
  OnDestroy,
  effect,
  ChangeDetectionStrategy
} from '@angular/core';
import * as THREE from 'three';
import { CanvasFilters } from '@interfaces/three-d-nodes-filters.interface';
import { FiltersDataService } from '../services/filters-data.service';
import { OrbitControls } from 'three-stdlib';
import {
  CAMERA_CONFIG,
  CONNECTION_CONFIG,
  CONTROLS_CONFIG,
  IMAGE_PROCESSING,
  LIGHTING_CONFIG,
  NODE_CONFIG,
  RENDERER_CONFIG,
  SCENE_CONFIG,
} from '../constants/canvas.constants';

@Component({
  selector: 'three-d-nodes-canvas',
  template: `<div class="relative">
    <canvas
      class="bg-bg-canvas max-w-full"
      [style.transform-origin]="transformOrigin"
      #threeCanvas
    ></canvas>
    <!-- Download Button -->
    <button
      (click)="downloadCanvas()"
      class="absolute bottom-4 right-4 bg-accent-primary hover:bg-accent-secondary text-white font-bold py-2 px-4 rounded"
    >
      Download Image
    </button>
  </div>`,
  styles: [
    `
      canvas {
        display: block;
        width: 100%;
        height: 100%;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: true,
})
export class Three3DCanvasComponent implements AfterViewInit, OnDestroy {
  transformOrigin = '0 0';

  private canvas!: HTMLCanvasElement;

  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private controls!: OrbitControls;
  private animationId!: number;
  private graph!: THREE.Group;
  private currentImage!: HTMLImageElement;
  private isInitialized = false;

  constructor(
    private el: ElementRef,
    private filtersDataService: FiltersDataService
  ) {
    effect(() => {
      const filters = this.filtersDataService.currentFilters();
      if (filters && this.isInitialized) {
        this.processImage(filters);
      }
    });
  }

  ngAfterViewInit(): void {
    this.initThreeJS();
    this.animate();
    this.isInitialized = true;
    const currentFilters = this.filtersDataService.currentFilters();
    if (currentFilters) {
      this.processImage(currentFilters);
    }
  }

  ngOnDestroy(): void {
    console.log('Canvas destroyed');
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    if (this.renderer) {
      this.renderer.dispose();
    }
  }

  public downloadCanvas(): void {
    // Temporarily increase render quality
    const originalSize = {
      width: this.renderer.getSize(new THREE.Vector2()).x,
      height: this.renderer.getSize(new THREE.Vector2()).y,
    };

    // Render at higher resolution
    this.renderer.setSize(
      originalSize.width * 2,
      originalSize.height * 2,
      false
    );
    this.camera.aspect = (originalSize.width * 2) / (originalSize.height * 2);
    this.camera.updateProjectionMatrix();
    this.renderer.render(this.scene, this.camera);

    // Create download
    const image = this.renderer.domElement.toDataURL('image/png');
    const link = document.createElement('a');
    const fileName = `3d-nodes-${new Date().toISOString().slice(0, 10)}.png`;
    link.download = fileName;
    link.href = image;
    link.click();

    // Restore original size
    this.renderer.setSize(originalSize.width, originalSize.height, false);
    this.camera.aspect = originalSize.width / originalSize.height;
    this.camera.updateProjectionMatrix();
    this.renderer.render(this.scene, this.camera);

    // Cleanup
    link.remove();
  }

  private initThreeJS(): void {
    /*
      Init ThreeJS will do the following:
      1. Create a Three.js scene (canvas)
      2. Create a Camera with settings
      3. Create a WebGLRenderer with settings
      4. Create OrbitControls for camera manipulation
      5. Add lighting to the scene
    */

    this.canvas = this.el.nativeElement.querySelector('canvas');

    if (!this.canvas) return;

    // 1. Creating Three.js scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(SCENE_CONFIG.BACKGROUND_COLOR);

    // 2. Creating camera settings
    this.camera = new THREE.PerspectiveCamera(
      SCENE_CONFIG.FOV,
      this.canvas.clientWidth / this.canvas.clientHeight,
      SCENE_CONFIG.NEAR_PLANE,
      SCENE_CONFIG.FAR_PLANE
    );
    this.camera.position.z = CAMERA_CONFIG.INITIAL_POSITION_Z;

    // 3. Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: RENDERER_CONFIG.ANTIALIAS,
    });
    this.renderer.setSize(this.canvas.clientWidth, this.canvas.clientHeight);

    // 4. Orbit Controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = CONTROLS_CONFIG.ENABLE_DAMPING;
    this.controls.dampingFactor = CONTROLS_CONFIG.DAMPING_FACTOR;

    // 5. Lighting
    const ambientLight = new THREE.AmbientLight(
      LIGHTING_CONFIG.AMBIENT_LIGHT.COLOR,
      LIGHTING_CONFIG.AMBIENT_LIGHT.INTENSITY
    );
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(
      LIGHTING_CONFIG.DIRECTIONAL_LIGHT.COLOR,
      LIGHTING_CONFIG.DIRECTIONAL_LIGHT.INTENSITY
    );
    directionalLight.position.set(
      LIGHTING_CONFIG.DIRECTIONAL_LIGHT.POSITION.X,
      LIGHTING_CONFIG.DIRECTIONAL_LIGHT.POSITION.Y,
      LIGHTING_CONFIG.DIRECTIONAL_LIGHT.POSITION.Z
    );
    this.scene.add(directionalLight);
  }

  private animate(): void {
    this.animationId = requestAnimationFrame(() => this.animate());
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  private async processImage(filters: CanvasFilters): Promise<void> {
    if (this.graph) this.scene.remove(this.graph);

    if (!filters.image) {
      console.error('No image provided for processing');
      return;
    }

    // Load image && set currentImage
    this.currentImage = await this.loadImage(filters.image);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;

    // ✅ Usar el método existente para calcular dimensiones optimizadas
    const { width, height } = this.calculateDimensions(
      this.currentImage,
      IMAGE_PROCESSING.MAX_DIMENSION
    );

    canvas.width = width;
    canvas.height = height;
    ctx.drawImage(this.currentImage, 0, 0, width, height);

    this.generateGraph(canvas, filters);
  }

  private calculateDimensions(
    img: HTMLImageElement,
    maxDim: number
  ): { width: number; height: number } {
    let width = img.width;
    let height = img.height;

    // Mantener aspect ratio
    if (width > height && width > maxDim) {
      height = (maxDim / width) * height;
      width = maxDim;
    } else if (height > maxDim) {
      width = (maxDim / height) * width;
      height = maxDim;
    }

    return { width, height };
  }

  private loadImage(file: File): Promise<HTMLImageElement> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  }

  private generateGraph(
    canvas: HTMLCanvasElement,
    filters: CanvasFilters
  ): void {
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    const { gridSize, nodeSize, spacing, connectivitySelector } = filters;

    // Rows and cols: used to determine the number of nodes
    this.graph = new THREE.Group();
    const cols = Math.ceil(canvas.width / gridSize);
    const rows = Math.ceil(canvas.height / gridSize);

    // Material for connections config
    const connectionMaterial = new THREE.LineBasicMaterial({
      color: CONNECTION_CONFIG.COLOR,
      transparent: CONNECTION_CONFIG.TRANSPARENT,
      opacity: CONNECTION_CONFIG.OPACITY,
    });

    // Create nodes, connections, and node map
    const nodes = new THREE.Group();
    const connections = new THREE.Group();
    const nodeMap: Record<string, THREE.Mesh> = {};

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        // Process image cell to get RGB values
        const { r, g, b } = this.processImageCell(
          ctx,
          x,
          y,
          gridSize,
          canvas.width,
          canvas.height
        );

        // Creating node based on the extracted RGB values
        const node = this.createNode(
          r,
          g,
          b,
          nodeSize,
          x,
          y,
          cols,
          rows,
          spacing
        );
        nodes.add(node);
        nodeMap[`${x},${y}`] = node;

        // Create connections based on the nodes
        this.createConnections(
          x,
          y,
          rows,
          cols,
          connectivitySelector,
          nodeMap,
          connections,
          connectionMaterial
        );
      }
    }

    this.graph.add(nodes);
    this.graph.add(connections);
    this.scene.add(this.graph);

    this.adjustCameraToGraph();
  }

  private processImageCell(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    gridSize: number,
    imgWidth: number,
    imgHeight: number
  ): { r: number; g: number; b: number } {
    /*
      Process a cell in the image to get average RGB values.
      The cell is defined by gridSize and its position (x, y).
    */
    const startX = x * gridSize;
    const startY = y * gridSize;
    const cellWidth = Math.min(gridSize, imgWidth - startX);
    const cellHeight = Math.min(gridSize, imgHeight - startY);

    const imageData = ctx.getImageData(startX, startY, cellWidth, cellHeight);
    const data = imageData.data;

    let r = 0,
      g = 0,
      b = 0;

    for (let i = 0; i < data.length; i += IMAGE_PROCESSING.RGBA_STEP) {
      r += data[i + IMAGE_PROCESSING.COLOR_CHANNELS.RED];
      g += data[i + IMAGE_PROCESSING.COLOR_CHANNELS.GREEN];
      b += data[i + IMAGE_PROCESSING.COLOR_CHANNELS.BLUE];
    }

    const pixelCount = data.length / IMAGE_PROCESSING.RGBA_STEP;
    return {
      r: r / pixelCount / IMAGE_PROCESSING.COLOR_NORMALIZATION,
      g: g / pixelCount / IMAGE_PROCESSING.COLOR_NORMALIZATION,
      b: b / pixelCount / IMAGE_PROCESSING.COLOR_NORMALIZATION,
    };
  }

  private createNode(
    r: number,
    g: number,
    b: number,
    size: number,
    x: number,
    y: number,
    cols: number,
    rows: number,
    spacing: number
  ): THREE.Mesh {
    const geometry = new THREE.SphereGeometry(
      size,
      NODE_CONFIG.GEOMETRY.WIDTH_SEGMENTS,
      NODE_CONFIG.GEOMETRY.HEIGHT_SEGMENTS
    );
    // RGB Channels
    const colorComponents = NODE_CONFIG.COLOR_COMPONENTS;
    const colors = Array(
      geometry.attributes['position'].count * colorComponents
    ).fill(0);

    for (let i = 0; i < colors.length; i += colorComponents) {
      colors[i] = r;
      colors[i + 1] = g;
      colors[i + 2] = b;
    }

    geometry.setAttribute(
      'color',
      new THREE.Float32BufferAttribute(colors, colorComponents)
    );
    const material = new THREE.MeshPhongMaterial({ vertexColors: true });
    const node = new THREE.Mesh(geometry, material);

    node.position.set((x - cols / 2) * spacing, (rows / 2 - y) * spacing, 0);

    return node;
  }

  private createConnections(
    x: number,
    y: number,
    rows: number,
    cols: number,
    connectivity: number,
    nodeMap: Record<string, THREE.Mesh>,
    connections: THREE.Group,
    material: THREE.LineBasicMaterial
  ): void {
    // Get neighbors based on connectivity
    // 4-connectivity or 8-connectivity
    const neighbors = this.getNeighbors(x, y, rows, cols, connectivity);

    // Create connections to neighbors
    neighbors.forEach(([nx, ny]) => {
      const neighbor = nodeMap[`${nx},${ny}`];
      if (neighbor) {
        const current = nodeMap[`${x},${y}`];
        const geometry = new THREE.BufferGeometry().setFromPoints([
          current.position,
          neighbor.position,
        ]);
        connections.add(new THREE.Line(geometry, material));
      }
    });
  }

  private getNeighbors(
    x: number,
    y: number,
    rows: number,
    cols: number,
    connectivity: number
  ): [number, number][] {
    /* Return e.g.
      - For 4-connectivity:
      [
        [x-1, y] (left), [x+1, y] (right),
        [x, y-1] (top), [x, y+1] (bottom)
      ]
    */
    const neighbors: [number, number][] = [];

    // 4-conectividad
    if (x > 0) neighbors.push([x - 1, y]);
    if (x < cols - 1) neighbors.push([x + 1, y]);
    if (y > 0) neighbors.push([x, y - 1]);
    if (y < rows - 1) neighbors.push([x, y + 1]);

    // 8-conectividad (add diagonal connections)
    if (connectivity === 8) {
      if (x > 0 && y > 0) neighbors.push([x - 1, y - 1]);
      if (x < cols - 1 && y > 0) neighbors.push([x + 1, y - 1]);
      if (x > 0 && y < rows - 1) neighbors.push([x - 1, y + 1]);
      if (x < cols - 1 && y < rows - 1) neighbors.push([x + 1, y + 1]);
    }

    return neighbors;
  }

  private adjustCameraToGraph(): void {
    /*
      Calculate the bounding box of the graph and adjust the camera position
      to fit the entire graph within the view.
    */
    const box = new THREE.Box3().setFromObject(this.graph);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());

    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = this.camera.fov * (Math.PI / 180);
    // Calculate camera Z position based on the size of the graph
    // division by 2 to center the camera
    let cameraZ =
      Math.abs(maxDim / 2 / Math.tan(fov / 2)) *
      CAMERA_CONFIG.CAMERA_DISTANCE_MULTIPLIER;

    cameraZ = Math.max(cameraZ, CAMERA_CONFIG.MIN_DISTANCE);
    this.camera.position.z = cameraZ;
    this.controls.target.copy(center);
    this.controls.update();
  }
}
