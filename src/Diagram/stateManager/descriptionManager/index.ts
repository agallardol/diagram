import { DiagramState, Node, DiagramTheme } from "../../../Models";
import { EventBus } from "../../../EventBus";
import { DiagramEvents, IOEvents } from "../../../Events";
import { HtmlManager, HtmlElementRegistration } from "../htmlManager";
import { CSSMiniEngine } from "../../../Renderer/CssMiniEngine";
import { Utils } from "../../../Utils";
import { ConfigurationManager } from "../../../Configuration";

const CSS_PREFIX = Utils.getUniquePrefix("DescriptionManager");

const containerClass = {
  position: "fixed",
  transformOrigin: "top left"
};

const descriptionClass = (theme: DiagramTheme) => ({
  borderRadius: "3px",
  padding: "10px",
  background: theme.colors.description.background,
  color: theme.colors.description.text,
  width: `${theme.description.width}px`,
  textAlign: "center",
  outline: "none",
  font: `normal ${theme.description.fontSize}px Helvetica`,
  lineHeight: `${theme.description.lineHeight}px`
});

const descriptionSpanClass = (theme: DiagramTheme) => ({
  minWidth: "10px",
  minHeight: "14px",
  display: "inline-block",
  outline: "none"
});

const descriptionSeparatorClass = {
  height: "10px",
  pointerEvents: "none",
  position: "relative"
};

const descriptionSeparatorClassAfter = (theme: DiagramTheme) => ({
  left: "50%",
  width: "10px",
  height: "10px",
  position: "absolute",
  transform: "translate(-5px, -5px) rotate(45deg)",
  background: theme.colors.description.background
});

export class DescriptionManager {
  static containerClassName = `${CSS_PREFIX}Container`;
  static descriptionClassName = `${CSS_PREFIX}Description`;
  static descriptionSpanClassName = `${CSS_PREFIX}DescriptionSpan`;
  static separatorClassName = `${CSS_PREFIX}Separator`;

  DESCRIPTION_PLACEHOLDER: string | undefined;
  registeredDescriptionElement: HtmlElementRegistration | null = null;
  selectedNode: Node | null = null;

  constructor(
    private state: DiagramState,
    private eventBus: EventBus,
    private htmlManager: HtmlManager
  ) {
    this.state;
    this.DESCRIPTION_PLACEHOLDER = ConfigurationManager.instance.getOption(
      "theme"
    ).description.placeholder;
    this.eventBus.subscribe(
      DiagramEvents.NodeSelected,
      this.nodeSelectionChange
    );

    const {
      containerClassName,
      descriptionClassName,
      separatorClassName,
      descriptionSpanClassName
    } = DescriptionManager;

    this.eventBus.subscribe(IOEvents.WorldMouseDrag, this.nodeMoving);
    this.eventBus.subscribe(DiagramEvents.NodeMoved, this.nodeMoved);

    CSSMiniEngine.instance.addClass(containerClass, containerClassName);
    CSSMiniEngine.instance.addClass(descriptionClass, descriptionClassName);
    CSSMiniEngine.instance.addClass(
      descriptionSpanClass,
      descriptionSpanClassName
    );
    CSSMiniEngine.instance.addClass(
      descriptionSeparatorClass,
      separatorClassName
    );
    CSSMiniEngine.instance.addClass(
      descriptionSeparatorClassAfter,
      separatorClassName,
      "::after"
    );
  }

  nodeMoving = () => {
    if (this.selectedNode && this.registeredDescriptionElement) {
      if (this.state.selectedNodes.indexOf(this.selectedNode) > -1) {
        this.registeredDescriptionElement.refs.container.style.pointerEvents =
          "none";
      }
    }
  };

  nodeMoved = () => {
    if (this.selectedNode && this.registeredDescriptionElement) {
      this.registeredDescriptionElement.refs.container.style.pointerEvents =
        "all";
    }
  };

  assignDescriptionToNode = () => {
    if (this.registeredDescriptionElement) {
      const descriptionObjectContent = (this.registeredDescriptionElement.refs
        .span as HTMLSpanElement).innerHTML;
      if (
        this.selectedNode &&
        descriptionObjectContent !== this.DESCRIPTION_PLACEHOLDER
      ) {
        this.selectedNode!.description = descriptionObjectContent;
        this.eventBus.publish(DiagramEvents.NodeChanged);
      }
    }
  };

  clearDescription = () => {
    if (this.registeredDescriptionElement) {
      this.assignDescriptionToNode();
      this.registeredDescriptionElement.remove();
    }
  };

  getNodeDescriptionValue = (node: Node) => {
    return node.description || this.DESCRIPTION_PLACEHOLDER;
  };

  nodeSelectionChange = () => {
    if (
      this.state.selectedNodes.length === 0 ||
      this.state.selectedNodes.length > 1
    ) {
      this.clearDescription();
      return;
    }

    const node = this.state.selectedNodes[0];

    const isReadonly =
      this.state.isReadOnly || node.readonly || node.notEditable;

    if (isReadonly && !node.description) {
      this.clearDescription();
      return;
    }

    this.registerNodeEditedDescription(node);
  };

  registerNodeEditedDescription = (node: Node) => {
    const {
      containerClassName,
      descriptionClassName,
      separatorClassName,
      descriptionSpanClassName
    } = DescriptionManager;

    const isReadonly =
      this.state.isReadOnly || node.readonly || node.notEditable;

    this.clearDescription();
    const { x, y } = node;
    const isContentEditable = isReadonly ? "" : "contenteditable";
    const elementRegistration = this.htmlManager.createElementFromHTML(
      `
      <div class="${containerClassName}" data-ref="container">
        <div class="${descriptionClassName}">
          <span data-ref="span" ${isContentEditable} class="${descriptionSpanClassName}">${this.getNodeDescriptionValue(
        node
      )}</span>
        </div>
        <div class="${separatorClassName}"></div>
      </div>
    `,
      x,
      y,
      false,
      "topCenter",
      node
    );

    const { refs } = elementRegistration;

    refs.span.addEventListener("blur", () => {
      this.assignDescriptionToNode();
    });

    refs.span.addEventListener("focus", () => {
      if (!node.description) {
        var range = document.createRange();
        range.selectNodeContents(refs.span);
        var sel = window.getSelection();
        if (sel) {
          sel.removeAllRanges();
          sel.addRange(range);
        }
      }
    });

    this.selectedNode = node;
    this.registeredDescriptionElement = elementRegistration;
    this.eventBus.publish(DiagramEvents.RenderRequested);
  };
}
