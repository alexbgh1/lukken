import {
  Component,
  ElementRef,
  AfterViewInit,
  OnDestroy,
  effect,
  ChangeDetectionStrategy,
} from '@angular/core';
import * as THREE from 'three';
import { CanvasFilters } from '@interfaces/three-d-nodes-filters.interface';
import { FiltersDataService } from '../services/filters-data.service';
import { IMAGE_DECODE_ERROR } from '@shared/utils/decode-image';
import {
  OrbitControls,
  EffectComposer,
  RenderPass,
  UnrealBloomPass,
} from 'three-stdlib';
import {
  BLOOM_CONFIG,
  CAMERA_CONFIG,
  CONTROLS_CONFIG,
  IMAGE_PROCESSING,
  LIGHTING_CONFIG,
  NODE_CONFIG,
  RENDERER_CONFIG,
  SCENE_CONFIG,
} from '../constants/canvas.constants';

@Component({
  selector: 'three-d-nodes-canvas',
  template: `<div class="relative h-full">
    <canvas
      class="bg-bg-canvas w-full h-full"
      [style.transform-origin]="transformOrigin"
      #threeCanvas
    ></canvas>
  </div>`,
  styles: [
    `
      /* A viewport, not a picture: it should take every pixel the frame
         offers, since orbit and zoom are what frame the subject. */
      :host {
        display: block;
        height: 100%;
      }

      canvas {
        display: block;
        width: 100%;
        height: 100%;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
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

  private composer!: EffectComposer;
  private resizeObserver: ResizeObserver | null = null;
  private lastWidth = 0;
  private lastHeight = 0;
  private bloomPass!: UnrealBloomPass;

  private isUserDragging = false;

  private processGeneration = 0;

  private cloudPositions: Float32Array | null = null;
  private cloudOrigins: Float32Array | null = null;
  private cloudGeometry: THREE.BufferGeometry | null = null;
  private interactiveEnabled = false;
  private mouseNDC = new THREE.Vector2();
  private raycaster = new THREE.Raycaster();

  // Reuse these objects instead of allocating in every RAF frame
  private _interactPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  private _interactPoint = new THREE.Vector3();

  // Store handler reference so ngOnDestroy can remove it
  private _mouseMoveHandler!: (event: MouseEvent) => void;

  constructor(
    private el: ElementRef,
    private filtersDataService: FiltersDataService,
  ) {
    effect(() => {
      const filters = this.filtersDataService.currentFilters();
      if (filters && this.isInitialized) {
        this.processImage(filters);
      }
    });
    effect(() => {
      this.interactiveEnabled = this.filtersDataService.interactive();
    });
  }

  ngAfterViewInit(): void {
    this.initThreeJS();
    this.observeResize();
    this.animate();
    this.isInitialized = true;
    const currentFilters = this.filtersDataService.currentFilters();
    if (currentFilters) {
      this.processImage(currentFilters);
    }
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();

    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }

    if (this.renderer?.domElement && this._mouseMoveHandler) {
      this.renderer.domElement.removeEventListener(
        'mousemove',
        this._mouseMoveHandler,
      );
    }

    if (this.controls) {
      this.controls.dispose();
    }

    if (this.graph) {
      this.disposeGroup(this.graph);
    }

    if (this.composer) {
      this.composer.dispose();
    }

    if (this.renderer) {
      this.renderer.dispose();
    }
  }

  private disposeGroup(group: THREE.Group): void {
    group.traverse((obj) => {
      if (obj instanceof THREE.Mesh || obj instanceof THREE.Points) {
        obj.geometry?.dispose();
        if (Array.isArray(obj.material)) {
          obj.material.forEach((m) => m.dispose());
        } else {
          obj.material?.dispose();
        }
      }
    });
  }

  public downloadCanvas(): void {
    if (!this.renderer || !this.composer) return;
    const originalSize = {
      width: this.renderer.getSize(new THREE.Vector2()).x,
      height: this.renderer.getSize(new THREE.Vector2()).y,
    };

    const w2 = originalSize.width * 2;
    const h2 = originalSize.height * 2;

    this.renderer.setSize(w2, h2, false);
    this.composer.setSize(w2, h2);
    this.camera.aspect = w2 / h2;
    this.camera.updateProjectionMatrix();
    this.composer.render();

    const image = this.renderer.domElement.toDataURL('image/png');
    const link = document.createElement('a');
    const fileName = `3d-nodes-${new Date().toISOString().slice(0, 10)}.png`;
    link.download = fileName;
    link.href = image;
    link.click();
    link.remove();

    this.renderer.setSize(originalSize.width, originalSize.height, false);
    this.composer.setSize(originalSize.width, originalSize.height);
    this.camera.aspect = originalSize.width / originalSize.height;
    this.camera.updateProjectionMatrix();
    this.composer.render();
  }

  private initThreeJS(): void {
    this.canvas = this.el.nativeElement.querySelector('canvas');
    if (!this.canvas) return;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(SCENE_CONFIG.BACKGROUND_COLOR);

    this.camera = new THREE.PerspectiveCamera(
      SCENE_CONFIG.FOV,
      this.canvas.clientWidth / this.canvas.clientHeight,
      SCENE_CONFIG.NEAR_PLANE,
      SCENE_CONFIG.FAR_PLANE,
    );
    this.camera.position.z = CAMERA_CONFIG.INITIAL_POSITION_Z;

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: RENDERER_CONFIG.ANTIALIAS,
    });
    // `updateStyle: false` keeps Three.js from writing inline width/height
    // onto the canvas, which would override the CSS that makes it fill the
    // frame and freeze it at its startup size.
    this.renderer.setSize(
      this.canvas.clientWidth,
      this.canvas.clientHeight,
      false,
    );

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = CONTROLS_CONFIG.ENABLE_DAMPING;
    this.controls.dampingFactor = CONTROLS_CONFIG.DAMPING_FACTOR;

    this.controls.addEventListener('start', () => {
      this.isUserDragging = true;
    });
    this.controls.addEventListener('end', () => {
      this.isUserDragging = false;
    });

    this._mouseMoveHandler = (event: MouseEvent) => {
      const rect = this.renderer.domElement.getBoundingClientRect();
      this.mouseNDC.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouseNDC.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    };
    this.renderer.domElement.addEventListener(
      'mousemove',
      this._mouseMoveHandler,
    );

    const ambientLight = new THREE.AmbientLight(
      LIGHTING_CONFIG.AMBIENT_LIGHT.COLOR,
      LIGHTING_CONFIG.AMBIENT_LIGHT.INTENSITY,
    );
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(
      LIGHTING_CONFIG.DIRECTIONAL_LIGHT.COLOR,
      LIGHTING_CONFIG.DIRECTIONAL_LIGHT.INTENSITY,
    );
    directionalLight.position.set(
      LIGHTING_CONFIG.DIRECTIONAL_LIGHT.POSITION.X,
      LIGHTING_CONFIG.DIRECTIONAL_LIGHT.POSITION.Y,
      LIGHTING_CONFIG.DIRECTIONAL_LIGHT.POSITION.Z,
    );
    this.scene.add(directionalLight);

    this.initBloom();
  }

  /**
   * Returns the camera and the scene to a straight-on framing.
   *
   * Two separate rotations accumulate here: orbiting moves the CAMERA, while
   * auto-rotate spins the GRAPH. Resetting only the controls would leave the
   * scene still turned, so both have to be put back.
   */
  resetView(): void {
    this.controls?.reset();
    this.graph?.rotation.set(0, 0, 0);
    if (this.camera) {
      this.camera.position.set(0, 0, CAMERA_CONFIG.INITIAL_POSITION_Z);
      this.camera.rotation.set(0, 0, 0);
      this.camera.updateProjectionMatrix();
    }
    this.controls?.target.set(0, 0, 0);
    this.controls?.update();
  }

  /**
   * Keeps the drawing buffer and the camera in step with the frame.
   *
   * Sizing without this happens once and never again, so the canvas keeps
   * whatever box it measured at startup and leaves dead margin down the right
   * and bottom of the stage once the layout settles.
   */
  private observeResize(): void {
    if (!this.canvas) return;
    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(this.canvas);
    this.handleResize();
  }

  private handleResize(): void {
    if (!this.canvas || !this.renderer) return;
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    if (width === 0 || height === 0) return;
    if (width === this.lastWidth && height === this.lastHeight) return;

    this.lastWidth = width;
    this.lastHeight = height;

    this.renderer.setSize(width, height, false);
    this.composer?.setSize(width, height);
    this.bloomPass?.setSize(width, height);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  private initBloom(): void {
    const size = new THREE.Vector2(
      this.canvas.clientWidth,
      this.canvas.clientHeight,
    );
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloomPass = new UnrealBloomPass(
      size,
      BLOOM_CONFIG.STRENGTH,
      BLOOM_CONFIG.RADIUS,
      BLOOM_CONFIG.THRESHOLD,
    );
    this.composer.addPass(this.bloomPass);
  }

  private updateBloom(strength: number, enabled: boolean): void {
    if (!this.bloomPass) return;
    this.bloomPass.strength = enabled ? strength : 0;
  }

  private animate(): void {
    this.animationId = requestAnimationFrame(() => this.animate());

    const filters = this.filtersDataService.currentFilters();

    if (filters?.autoRotate && this.graph && !this.isUserDragging) {
      const speed = (filters.autoRotateSpeed ?? 0.3) * 0.001;
      this.graph.rotation.y += speed;
    }

    if (
      this.interactiveEnabled &&
      this.cloudPositions &&
      this.cloudOrigins &&
      this.cloudGeometry
    ) {
      this.raycaster.setFromCamera(this.mouseNDC, this.camera);
      this._interactPoint.set(0, 0, 0);
      this.raycaster.ray.intersectPlane(
        this._interactPlane,
        this._interactPoint,
      );

      const pos = this.cloudPositions;
      const orig = this.cloudOrigins;
      const ix = this._interactPoint.x;
      const iy = this._interactPoint.y;
      const iz = this._interactPoint.z;
      const radius = 3;

      for (let i = 0, len = pos.length; i < len; i += 3) {
        const dx = pos[i] - ix;
        const dy = pos[i + 1] - iy;
        const dz = pos[i + 2] - iz;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

        if (dist < radius && dist > 0.001) {
          const force = ((radius - dist) / radius) * 0.5;
          pos[i] += (dx / dist) * force;
          pos[i + 1] += (dy / dist) * force;
          pos[i + 2] += (dz / dist) * force;
        }

        pos[i] += (orig[i] - pos[i]) * 0.05;
        pos[i + 1] += (orig[i + 1] - pos[i + 1]) * 0.05;
        pos[i + 2] += (orig[i + 2] - pos[i + 2]) * 0.05;
      }

      this.cloudGeometry.attributes['position'].needsUpdate = true;
    }

    this.controls.update();
    this.composer.render();
  }

  /**
   * Rebuilds the scene, reporting progress while it runs.
   *
   * Split from the work itself so the flag is cleared on every exit path,
   * including the early returns for a missing image or a superseded run.
   */
  private async processImage(filters: CanvasFilters): Promise<void> {
    const gen = ++this.processGeneration;
    this.filtersDataService.setProcessing(true);
    // Two nested animation frames, so the indicator is actually on screen
    // before the blocking build begins. A setTimeout yields the task but does
    // not promise a paint.
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve(null))),
    );
    try {
      this.filtersDataService.setLoadError(null);
      await this.buildScene(filters, gen);
    } catch {
      this.filtersDataService.setLoadError(IMAGE_DECODE_ERROR);
      this.filtersDataService.imageSlot.clear();
    } finally {
      if (gen === this.processGeneration) {
        this.filtersDataService.setProcessing(false);
      }
    }
  }

  private async buildScene(filters: CanvasFilters, gen: number): Promise<void> {
    if (this.graph) {
      this.disposeGroup(this.graph);
      this.scene.remove(this.graph);
    }

    this.scene.background = new THREE.Color(filters.backgroundColor);
    this.updateBloom(filters.bloomStrength, filters.bloomEnabled ?? true);

    this.cloudPositions = null;
    this.cloudOrigins = null;
    this.cloudGeometry = null;

    if (!filters.image) {
      console.error('No image provided for processing');
      return;
    }

    this.currentImage = await this.loadImage(filters.image);
    if (gen !== this.processGeneration) return;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    const { width, height } = this.calculateDimensions(
      this.currentImage,
      IMAGE_PROCESSING.MAX_DIMENSION,
    );

    canvas.width = width;
    canvas.height = height;
    ctx.drawImage(this.currentImage, 0, 0, width, height);

    if (filters.colorCloud) {
      this.generateColorCloud(this.currentImage, filters);
    } else {
      this.generateGraph(canvas, filters);
    }
  }

  private calculateDimensions(
    img: HTMLImageElement,
    maxDim: number,
  ): { width: number; height: number } {
    let width = img.width;
    let height = img.height;

    if (width > height && width > maxDim) {
      height = (maxDim / width) * height;
      width = maxDim;
    } else if (height > maxDim) {
      width = (maxDim / height) * width;
      height = maxDim;
    }

    return { width, height };
  }

  /**
   * Reads and decodes the file.
   *
   * Both failure paths have to settle the promise. Before, neither did: a file
   * the browser could not decode left the caller awaiting forever, which since
   * the progress indicator arrived also meant a spinner that never stopped.
   */
  private loadImage(file: File): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error(IMAGE_DECODE_ERROR));
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(IMAGE_DECODE_ERROR));
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  }

  private generateGraph(
    canvas: HTMLCanvasElement,
    filters: CanvasFilters,
  ): void {
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    const { gridSize, nodeSize, spacing } = filters;

    this.graph = new THREE.Group();
    const cols = Math.ceil(canvas.width / gridSize);
    const rows = Math.ceil(canvas.height / gridSize);
    let cellCount = 0;
    let nodeCount = 0;

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        cellCount++;
        const { r, g, b } = this.processImageCell(
          ctx,
          x,
          y,
          gridSize,
          canvas.width,
          canvas.height,
        );
        const node = this.createNode(
          r,
          g,
          b,
          nodeSize,
          x,
          y,
          cols,
          rows,
          spacing,
        );
        this.graph.add(node);
        nodeCount++;
      }
    }

    this.filtersDataService.updateNodeMetrics({
      cellCount,
      nodeCount,
      compressionRatio:
        cellCount > 0 ? Math.round((1 - nodeCount / cellCount) * 100) : 0,
    });

    this.scene.add(this.graph);
    this.adjustCameraToGraph();
  }

  private hue(r: number, g: number, b: number): number {
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;
    if (delta === 0) return 0;
    let hue = 0;
    if (max === r) hue = ((g - b) / delta + (g < b ? 6 : 0)) / 6;
    else if (max === g) hue = ((b - r) / delta + 2) / 6;
    else hue = ((r - g) / delta + 4) / 6;
    return hue;
  }

  private saturation(r: number, g: number, b: number): number {
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    return max !== 0 ? (max - min) / max : 0;
  }

  private luminance(r: number, g: number, b: number): number {
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  private generateColorCloud(
    image: HTMLImageElement,
    filters: CanvasFilters,
  ): void {
    const { cloudSamples, nodeSize, cloudMode } = filters;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    canvas.width = image.width;
    canvas.height = image.height;
    ctx.drawImage(image, 0, 0);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const totalPixels = canvas.width * canvas.height;
    const sampleCount = Math.min(cloudSamples, totalPixels);

    const positions: number[] = [];
    const colors: number[] = [];
    const cloudScale = 8;
    const spread = 2;

    for (let i = 0; i < sampleCount; i++) {
      const idx = Math.floor(Math.random() * totalPixels) * 4;
      const r = data[idx] / 255;
      const g = data[idx + 1] / 255;
      const b = data[idx + 2] / 255;

      let x: number, y: number, z: number;

      switch (cloudMode) {
        case 'brightness-galaxy': {
          const lum = this.luminance(r, g, b);
          const h = this.hue(r, g, b);
          const radius = (1 - lum) * cloudScale;
          const armCount = 2;
          const armAngle = (Math.round(h * armCount) / armCount) * Math.PI * 2;
          const windingAngle = radius * 1.2;
          const scatter = (Math.random() - 0.5) * 1.5;
          const angle = armAngle + windingAngle + scatter;
          x = Math.cos(angle) * radius;
          y = Math.sin(angle) * radius;
          const bulgeFactor = Math.exp(-radius * 0.5);
          const discThickness = 0.3 + bulgeFactor * 2.5;
          z = (Math.random() - 0.5) * discThickness;
          const radialScatter = (Math.random() - 0.5) * 0.4 * (1 - lum);
          x += Math.cos(angle) * radialScatter;
          y += Math.sin(angle) * radialScatter;
          break;
        }
        case 'hue-ring': {
          const h = this.hue(r, g, b);
          const sat = this.saturation(r, g, b);
          const angle = h * Math.PI * 2;
          const radius = 0.5 + sat * (cloudScale - 0.5);
          x = Math.cos(angle) * radius;
          y = Math.sin(angle) * radius;
          z = (Math.random() - 0.5) * spread;
          break;
        }
        case 'saturation-burst': {
          const sat = this.saturation(r, g, b);
          const radius = sat * cloudScale;
          const angle = Math.random() * Math.PI * 2;
          x = Math.cos(angle) * radius;
          y = Math.sin(angle) * radius;
          z = (Math.random() - 0.5) * spread;
          break;
        }
        default: {
          x = (r - 0.5) * cloudScale;
          y = (g - 0.5) * cloudScale;
          z = (b - 0.5) * cloudScale;
          break;
        }
      }

      positions.push(x, y, z);
      colors.push(r, g, b);
    }

    this.graph = new THREE.Group();
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(positions, 3),
    );
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

    this.cloudGeometry = geometry;
    this.cloudPositions = geometry.attributes['position'].array as Float32Array;
    this.cloudOrigins = new Float32Array(this.cloudPositions);

    const material = new THREE.PointsMaterial({
      size: nodeSize * 0.15,
      vertexColors: true,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.85,
    });

    const points = new THREE.Points(geometry, material);
    this.graph.add(points);
    this.scene.add(this.graph);

    this.filtersDataService.updateNodeMetrics({
      cellCount: totalPixels,
      nodeCount: sampleCount,
      compressionRatio: Math.round((1 - sampleCount / totalPixels) * 100),
    });

    this.adjustCameraToGraph();
  }

  private processImageCell(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    gridSize: number,
    imgWidth: number,
    imgHeight: number,
  ): { r: number; g: number; b: number } {
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
    spacing: number,
  ): THREE.Mesh {
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const finalSize = size * (0.5 + luminance);

    const geometry = new THREE.SphereGeometry(
      finalSize,
      NODE_CONFIG.GEOMETRY.WIDTH_SEGMENTS,
      NODE_CONFIG.GEOMETRY.HEIGHT_SEGMENTS,
    );
    const colorComponents = NODE_CONFIG.COLOR_COMPONENTS;
    const colors = Array(
      geometry.attributes['position'].count * colorComponents,
    ).fill(0);

    for (let i = 0; i < colors.length; i += colorComponents) {
      colors[i] = r;
      colors[i + 1] = g;
      colors[i + 2] = b;
    }

    geometry.setAttribute(
      'color',
      new THREE.Float32BufferAttribute(colors, colorComponents),
    );
    const material = new THREE.MeshPhongMaterial({ vertexColors: true });
    const node = new THREE.Mesh(geometry, material);
    node.position.set((x - cols / 2) * spacing, (rows / 2 - y) * spacing, 0);

    return node;
  }

  private adjustCameraToGraph(): void {
    const box = new THREE.Box3().setFromObject(this.graph);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());

    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = this.camera.fov * (Math.PI / 180);
    let cameraZ =
      Math.abs(maxDim / 2 / Math.tan(fov / 2)) *
      CAMERA_CONFIG.CAMERA_DISTANCE_MULTIPLIER;
    cameraZ = Math.max(cameraZ, CAMERA_CONFIG.MIN_DISTANCE);

    this.camera.position.z = cameraZ;
    this.controls.target.copy(center);
    this.controls.update();
  }
}
