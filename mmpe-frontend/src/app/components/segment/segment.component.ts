import { Component, OnInit, Input } from '@angular/core';
import { Segment, SegmentStatus } from '../../model/segment';

@Component({
  selector: 'app-segment',
  templateUrl: './segment.component.html',
  styleUrls: ['./segment.component.scss']
})
export class SegmentComponent implements OnInit {
  @Input() segment: Segment;
  SegmentStatus: typeof SegmentStatus = SegmentStatus;

  constructor() { }

  ngOnInit() {
  }

}
