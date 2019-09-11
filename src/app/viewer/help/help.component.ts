import {Component, ElementRef, OnInit, ViewChild} from '@angular/core';
import * as d3 from 'd3';
import {ViewerProperties} from '../../shared/viewer.properties';

@Component({
  selector: 'app-help',
  templateUrl: './help.component.html',
  styleUrls: ['./help.component.scss']
})
export class HelpComponent implements OnInit {
  @ViewChild('svg') svgElement: ElementRef;
  private svg: d3.Selection<SVGElement, any, any, any>;

  private xCoordinate = 20;
  private yCoordinate = 15;

  constructor() {
  }

  ngOnInit() {
    this.svg = d3.select(this.svgElement.nativeElement);

    this.createLegendElements();
  }

  private incrementY() {
    this.yCoordinate += 40;
  }

  private createLegendElements() {
    this.createNode('Schema element with children', ViewerProperties.colors.filledNode);
    this.createNode('Schema element without children', ViewerProperties.colors.background);

    this.createTextElement('name', 'Not nullable schema element');
    this.createTextElement('name?', 'Nullable schema element (i.e. Union { null, X })');
    this.createTextElement('name*', 'Required schema element (i.e. no default value)');
    this.createTextElement('name [ ]', 'Array schema element');
    this.createTextElement('name { }', 'Map schema element');

  }

  private createNode(description: string, backgroundColor: string) {
    this.svg
      .append('circle')
      .attr('cx', this.xCoordinate + ViewerProperties.nodeSize)
      .attr('cy', this.yCoordinate)
      .attr('r', ViewerProperties.nodeSize)
      .style('fill', backgroundColor)
      .style('stroke', ViewerProperties.colors.nodeBorder)
      .style('stroke-width', ViewerProperties.nodeBorderWidth);
    this.svg
      .append('text')
      .attr('x', this.xCoordinate + 200)
      .attr('y', this.yCoordinate)
      .text(description)
      .attr('alignment-baseline', 'middle');

    this.incrementY();
  }

  private createTextElement(text: string, description: string) {
    this.svg
      .append('text')
      .attr('x', this.xCoordinate)
      .attr('y', this.yCoordinate)
      .text(text)
      .attr('alignment-baseline', 'middle');
    this.svg
      .append('text')
      .attr('x', this.xCoordinate + 200)
      .attr('y', this.yCoordinate)
      .text(description)
      .attr('alignment-baseline', 'middle');

    this.incrementY();
  }
}
