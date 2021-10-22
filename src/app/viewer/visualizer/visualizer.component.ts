import { Component, ElementRef, EventEmitter, OnInit, Output, ViewChild } from '@angular/core';
import * as d3 from 'd3';
import { HierarchyNode, HierarchyPointNode } from 'd3';
import { SchemaService } from '../../services/schema.service';
import { ArraySchema, AvroSchema, AvroUtil, EnumSchema, ErrorUnionSchema, Field, FixedSchema, MapSchema, PrimitiveSchema, RecordSchema, SchemaType, UnionSchema } from '../../models/avro-schema.model';
import { Location } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { ViewerProperties } from '../../shared/viewer.properties';
import { Util } from '../../shared/util';

@Component({
  selector: 'app-visualizer',
  templateUrl: './visualizer.component.html',
  styleUrls: ['./visualizer.component.scss']
})
export class VisualizerComponent implements OnInit {
  @ViewChild('svg') svgElement: ElementRef;
  private svg: d3.Selection<SVGElement, any, any, any>;
  private zoomFrame: d3.Selection<SVGGElement, any, any, any>;
  private frame: d3.Selection<SVGGElement, any, any, any>;
  private nodeMetadata: { [nodeFullpath: string]: NodeMetaData } = {};

  private treeLayout = d3.tree<SchemaType>().nodeSize([60, 300]);
  private zoom = d3.zoom().scaleExtent([.1, 3]).on('zoom', () => this.onZoom());

  private avroSchema: SchemaType;
  private previousNodes: HierarchyPointNode<any>[];
  private schemaVersion: string;

  @Output() onSelectedNodePathChange = new EventEmitter<SchemaType>();

  private margin = 100;
  private width: number;
  private height: number;

  private recentering = false;
  public loading = true;

  constructor(private schemaService: SchemaService,
    private location: Location,
    private route: ActivatedRoute) {
  }

  ngOnInit() {
    const bbox = this.svgElement.nativeElement.getBoundingClientRect();
    this.width = bbox.width;
    this.height = bbox.height;

    this.svg = d3.select(this.svgElement.nativeElement);
    this.svg
      .style('background-color', ViewerProperties.colors.background)
      .call(this.zoom);

    this.zoomFrame = this.svg.append('g')
      .attr('class', 'zoom-frame');

    this.frame = this.zoomFrame.append('g')
      .attr('class', 'frame')
      .attr('transform', `translate(${this.margin},${this.height / 2})`);

    this.schemaService.getSchemaObservable()
      .subscribe(schema => {
          this.avroSchema = schema;

          this.setSchemaVersion(schema);
          this.initializeTreeMetadata();
          this.setStartPath();
        },
        error => {
          console.log(error);
        });
  }

  private setStartPath() {
    this.route.paramMap.subscribe(params => {
      let schemaFullPath = params.get('schemaFullPath');

      if (Util.isNullOrUndefined(schemaFullPath) // no path provided
        || schemaFullPath === this.avroSchema['fullpath'] // path matches root path
        || schemaFullPath.split('.')[0] !== this.avroSchema['fullpath'] // path does not start with the root nodes path
      ) {
        this.selectRootNode();
      } else {
        this.selectNodeByFullPath(schemaFullPath);
      }

      this.update(undefined, true);
      this.loading = false;
    });
  }

  private initializeTreeMetadata() {
    this.traverse(this.avroSchema, (n: SchemaType) => {
      if (this.nodeMetadata[n['fullpath']] === undefined) {
        this.nodeMetadata[n['fullpath']] = {fieldsVisible: false, isSelected: false};
      }
    });
  }

  /**
   * Checks whether a key 'fullVersion' states the version number of the schema. Falls back to the version number of the URL
   * @param schema the Avro Schema
   */
  private setSchemaVersion(schema: SchemaType) {
    if (Object.keys(schema.otherProperties).includes('fullVersion')) {
      this.schemaVersion = schema.otherProperties['fullVersion'];
    } else {
      this.schemaService.getCurrentVersionNumber()
        .subscribe(v => {
          this.schemaVersion = v;
        });
    }
  }

  /**
   * Takes a path (e.g. myRootNode.childNode.name) and opens the tree in the visualizer to this element in the tree.
   * @param schemaFullPath
   */
  public selectNodeByFullPath(schemaFullPath) {
    let match = AvroUtil.getAvroSchemaNodeByFullPath(schemaFullPath, this.avroSchema);

    if (Util.isNullOrUndefined(match)) {
      this.selectRootNode();
    } else {
      this.location.replaceState(`/viewer/${this.schemaVersion}/${schemaFullPath}`);
      this.openPathToNode(schemaFullPath);
      this.onElementNameSelect(match);
    }
  }

  private selectRootNode() {
    this.location.replaceState(`/viewer/${this.schemaVersion}/${this.avroSchema['fullpath']}`);
    this.nodeMetadata[this.avroSchema['fullpath']] = {fieldsVisible: true, isSelected: true};
    this.onSelectedNodePathChange.emit(this.avroSchema);
    this.recenter();
  }

  public recenter() {
    this.recentering = true;
    let x = this.width / 2;
    let y = this.height / 2;

    this.zoom.translateTo(this.svg, x, y);
    this.zoom.scaleTo(this.svg, 1);
    this.recentering = false;
  }

  public reposition(node) {
    this.recentering = true;

    // Important! the y coordinate represents the horizontal axis
    //            and the x coordinate represents the vertical axis
    this.zoom.translateTo(this.svg, node.y, node.x + (this.height / 2));
    this.recentering = false;
  }

  public expandAll() {
    this.setAllFieldsVisible(true);

    this.update(undefined, false);
    this.recenter();
  }

  public collapseAll() {
    this.setAllFieldsVisible(false);
    this.update(undefined, false);
    this.recenter();
  }

  public setAllFieldsVisible(visible: boolean) {
    Object.keys(this.nodeMetadata).forEach(key => {
      if (key !== this.avroSchema['fullpath']) {
        this.nodeMetadata[key].fieldsVisible = visible;
      }
    });
  }

  public search(s: string): string[] {
    s = s.toLowerCase();
    let matches: string[] = [];

    this.traverse(this.avroSchema, (n: SchemaType) => {
      if (Object.keys(n).includes('name')) {
        let fullpath = n['fullpath'];
        if (n['name'].toLowerCase().indexOf(s) !== -1 && !matches.includes(fullpath)) {
          matches.push(fullpath);
        }
      }
    });

    return matches;
  }

  /**
   * Draws the tree on the svg canvas.
   * @param originNodeFullname the fullname (e.g. myRootNode.childNode.name) of the node from which the tree should be drawn
   * @param removePreviousTree
   * @param zoomToNode zoom and pan to the selected tree node
   */
  private update(
    originNodeFullname: string | undefined = undefined,
    removePreviousTree: boolean = false,
    zoomToNode: boolean = false
  ) {
    if (removePreviousTree) {
      this.frame.selectAll('g').remove();
      this.frame.selectAll('path').remove();
      this.previousNodes = undefined;
    }

    const root: HierarchyNode<SchemaType> = d3.hierarchy(this.avroSchema, node => this.getChildren(node));
    const treeData = this.treeLayout(root);
    const nodes = treeData.descendants();
    const links = nodes.slice(1);

    // If this method runs for the first time, then initialize the previous nodes with the current ones
    if (!this.previousNodes) {
      this.previousNodes = nodes;
    }

    // Ensure there always is an origin node name
    if (originNodeFullname === undefined) {
      originNodeFullname = (treeData as HierarchyPointNode<SchemaType>).data.fullpath;
    }

    // There are two origin nodes:
    // - One with the current position of the node
    // - One with the new position of the node
    const originNode: HierarchyPointNode<SchemaType> = this.previousNodes.find((node: HierarchyPointNode<SchemaType>) => node.data.fullpath === originNodeFullname);
    const originNodeNew: HierarchyPointNode<SchemaType> = nodes.find((node: HierarchyPointNode<SchemaType>) => node.data.fullpath === originNodeFullname);

    // Keep track of the previous nodes
    this.previousNodes = nodes;


    // Render nodes
    const uiNodes = this.frame.selectAll('g.node')
      .data(nodes, (node: any) => node.data['fullpath']);

    const uiNodesEntered = uiNodes.enter()
      .insert('g', 'g')
      .attr('class', 'node')
      .attr('transform', `translate(${[originNode.y, originNode.x]})`);

    uiNodesEntered.append('circle')
      .attr('r', ViewerProperties.nodeSize)
      .on('click', node => this.onNodeClick(node));

    let visualizerComponent = this;

    uiNodesEntered
      .append('text')
      .attr('id', (node: HierarchyPointNode<SchemaType>) => Util.replaceDots(node.data.fullpath))
      .attr('y', -17)
      .attr('text-anchor', 'middle')
      .text((node: HierarchyPointNode<SchemaType>) => VisualizerComponent.getNodeText(node))
      .style('font-weight', (node: HierarchyPointNode<SchemaType>) => visualizerComponent.nodeMetadata[node.data.fullpath].isSelected ? 'bold' : '400')
      .style('fill', ViewerProperties.colors.text)
      .on('mouseover', function (d) {
        d3.select(this)
          .style('text-decoration', 'underline')
          .style('cursor', 'pointer');
      })
      .on('mouseout', function (d) {
        d3.select(this)
          .style('text-decoration', 'none')
          .style('cursor', 'auto');
      })
      .on('mousedown', node => this.onElementNameSelect(node.data))
      .on('dblclick', () => d3.event.stopPropagation())
      .transition()
      .duration(600);

    const mergedUiNodes = uiNodesEntered.merge(uiNodes as any);

    mergedUiNodes
      .transition()
      .duration(600)
      .attr('transform', node => `translate(${node.y},${node.x})`);

    mergedUiNodes.select('circle')
      .style('fill', node => this.hasHiddenChildren(node.data as SchemaType) ? ViewerProperties.colors.filledNode : ViewerProperties.colors.background)
      .style('stroke', ViewerProperties.colors.nodeBorder)
      .style('stroke-width', ViewerProperties.nodeBorderWidth);

    uiNodes.exit()
      .transition()
      .duration(600)
      .attr('transform', `translate(${[originNodeNew.y, originNodeNew.x]})`)
      .remove()
      .select('text')
      .style('opacity', 0);


    // LINKS
    const uiLinks = this.frame.selectAll('path.link')
      .data(links, (node: any) => node.data['fullpath']);

    const uiLinksEntered = uiLinks.enter()
      .insert('path', 'g')
      .attr('class', 'link')
      .attr('d', VisualizerComponent.polyline(originNode, originNode));

    uiLinksEntered.merge(uiLinks as any)
      .style('stroke', (node: HierarchyPointNode<SchemaType>) =>
        // _.includes(highlightedNodeIds, node.data['fullpath']) ? ViewerProperties.colors.highlight : ViewerProperties.colors.links
        ViewerProperties.colors.links
      )
      .style('stroke-width', ViewerProperties.linkWidth
      )
      .style('fill', 'none')
      .transition()
      .duration(600)
      .attr('d', node => VisualizerComponent.polyline(node, node.parent));

    uiLinks.exit()
      .transition()
      .duration(600)
      .attr('d', VisualizerComponent.polyline(originNodeNew, originNodeNew))
      .remove();

    // Reposition
    if (zoomToNode) {
      this.reposition(originNodeNew);
    }
  }

  private hasHiddenChildren(node: SchemaType): boolean {
    if (node instanceof PrimitiveSchema || node instanceof EnumSchema || node instanceof FixedSchema) {
      return false;
    } else if (node instanceof RecordSchema) {
      return !this.nodeMetadata[node['fullpath']].fieldsVisible;
    } else if (node instanceof MapSchema) {
      return !this.nodeMetadata[node['fullpath']].fieldsVisible && node.values instanceof RecordSchema;
    } else if (node instanceof ArraySchema) {
      return !this.nodeMetadata[node['fullpath']].fieldsVisible && node.items instanceof RecordSchema;
    } else if (node instanceof UnionSchema || node instanceof ErrorUnionSchema) {
      return !this.nodeMetadata[node['fullpath']].fieldsVisible && AvroUtil.getNonPrimitiveSchemas(node.schemas).length > 0;
    } else if (node instanceof Field) {
      return this.hasHiddenChildren(node.type);
    }
  }

  private getChildren(node: SchemaType, skipVisibleCheck: boolean = false): AvroSchema[] {
    if (!skipVisibleCheck) {
      if (!this.nodeMetadata[node['fullpath']].fieldsVisible) {
        return [];
      }
    }

    if (node instanceof Field) {
      return this.getChildren(node.type, true);
    } else if (node instanceof RecordSchema) {
      return Util.isObject(node.type) ? node.type['fields'] : node['fields'];
    } else if (node instanceof UnionSchema || node instanceof ErrorUnionSchema) {
      // When the parent is a union and there's only one child, display it as a direct child
      let nonPrimitiveSchemas = AvroUtil.getNonPrimitiveSchemas(node.schemas);

      return nonPrimitiveSchemas.length === 1
        ? this.getChildren(nonPrimitiveSchemas[0], skipVisibleCheck)
        : nonPrimitiveSchemas;
    } else if (node instanceof ArraySchema) {
      // When the parent is an array, and it's children are records, show them as a direct child
      return node.items instanceof RecordSchema ? [node.items] : [];
    } else if (node instanceof MapSchema) {
      // When the parent is a map, and it's children are records, show them as a direct child
      return node.values instanceof RecordSchema ? [node.values] : [];
    }
  }

  // Creates a polyline from parent to the child nodes
  private static polyline(start: HierarchyPointNode<SchemaType>, dest: HierarchyPointNode<SchemaType>) {
    return `M${start.y},${start.x}
            H${dest.y + 100}
            V${dest.x}
            H${dest.y}`;
  }

  private onNodeClick(node: HierarchyPointNode<SchemaType>) {
    this.openNode(node.data.fullpath);
  }

  private openNode(fullpath: string, zoomToNode: boolean = false) {
    this.nodeMetadata[fullpath].fieldsVisible = !this.nodeMetadata[fullpath].fieldsVisible;
    this.update(fullpath, false, zoomToNode);
  }

  private onElementNameSelect(schema) { // TODO set parameter type
    this.location.replaceState(`/viewer/${this.schemaVersion}/${schema['fullpath']}`);

    Object.keys(this.nodeMetadata).forEach(key => {
      this.nodeMetadata[key].isSelected = false;
    });

    this.nodeMetadata[schema['fullpath']].isSelected = true;
    d3.selectAll('text').style('font-weight', '400');
    let selection = d3.select('#' + Util.replaceDots(schema['fullpath']));

    selection.style('font-weight', 'bold');

    this.onSelectedNodePathChange.emit(schema);
  }

  private onZoom() {
    if (this.recentering) {
      this.zoomFrame
        .transition()
        .duration(600)
        .attr('transform', d3.event.transform);
    } else {
      this.zoomFrame.attr('transform', d3.event.transform);
    }
  }

  private openPathToNode(fullpath: string) {
    let paths = fullpath.split('.');

    paths.forEach((path, index) => {
      let currentPath = paths.slice(0, index + 1).join('.');
      if (!this.nodeMetadata[currentPath].fieldsVisible) {
        this.openNode(currentPath, paths.length === (index + 1));
      }
    });
  }

  private traverse(startingNode: SchemaType, fn: (AvroNode) => void) {
    const nodes: SchemaType[] = [startingNode];

    while (nodes.length > 0) {
      const node: SchemaType = nodes.pop();

      fn(node);

      addNodesToTraverse(node);
    }

    function addNodesToTraverse(node: SchemaType) {
      if (node instanceof Field) {
        addNodesToTraverse(node.type);
      } else if (node instanceof RecordSchema) {
        if (Object.keys(node).includes('fields')) {
          node.fields.forEach(child => nodes.push(child));
        }
      } else if (node instanceof UnionSchema) {
        node.schemas.forEach(schema => nodes.push(schema));
      } else if (node instanceof ErrorUnionSchema) {
        node.schemas.forEach(schema => nodes.push(schema));
      } else if (node instanceof ArraySchema) {
        nodes.push(node.items);
      } else if (node instanceof MapSchema) {
        nodes.push(node.values);
      }
    }
  }

  private static getNodeText(node: HierarchyPointNode<SchemaType>) {
    let typeProperties = '';

    if (node.data.type instanceof UnionSchema) {
      typeProperties = AvroUtil.isNullable(node.data.type.schemas) ? `${typeProperties}?` : typeProperties;
    }

    if (node.data.type instanceof ArraySchema) {
      typeProperties = `${typeProperties} [ ]`;
    }

    if (node.data.type instanceof MapSchema) {
      typeProperties = `${typeProperties} { }`
    }

    if (!node.data['hasDefault']) {
      typeProperties = `${typeProperties} *`;
    }

    return `${node.data.name ? node.data.name : node.data.fullpath}${typeProperties}`;
  }
}

interface NodeMetaData {
  fieldsVisible: boolean;
  isSelected: boolean;
}
