import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Says that the tool is working, next to the page title.
 *
 * Each tool used to signal this differently and in a different place: some put
 * it inside the button that started the work, some in the toolbar readout, and
 * 3D Nodes not at all. On a heavy image the pass can take a second or more, and
 * a user watching the canvas had no reason to believe anything was happening.
 *
 * Sitting beside the h1 gives it one predictable home across every tool, in the
 * one region every page shares.
 */
@Component({
  selector: 'processing-indicator',
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './processing-indicator.component.html',
})
export class ProcessingIndicatorComponent {
  active = input(false);
  label = input('Working');
}
