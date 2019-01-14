const Util = require('../../util');
const EventObject = require('@antv/g').Event;

const EVENTS = [
  'click',
  'mousedown',
  'mouseup',
  'dblclick',
  'contextmenu',
  'mouseenter',
  'mouseout',
  'mouseover',
  'mousemove',
  'mouseleave',
  'dragstart',
  'dragend',
  'drag',
  'dragenter',
  'dragleave',
  'drop'
];

const EXTEND_EVENTS = [
  'mousewheel',
  'wheel'
];

function getItemRoot(shape) {
  while (shape && !shape.get('item')) {
    shape = shape.get('parent');
  }
  return shape;
}

function cloneEvent(e) {
  return new EventObject(e.type, e, true, true);
}

class Event {
  constructor(graph) {
    this.graph = graph;
    this.extendEvents = [];
    this._initEvents();
  }
  _initEvents() {
    const self = this;
    const graph = self.graph;
    const canvas = graph.get('canvas');
    const el = canvas.get('el');
    const extendEvents = self.extendEvents;
    const canvasHandler = Util.wrapBehavior(self, '_onCanvasEvents');
    const originHandler = Util.wrapBehavior(self, '_onExtendEvents');
    Util.each(EVENTS, event => {
      canvas.on(event, canvasHandler);
    });
    this.canvasHandler = canvasHandler;

    Util.each(EXTEND_EVENTS, event => {
      extendEvents.push(Util.addEventListener(el, event, originHandler));
    });
    window && extendEvents.push(Util.addEventListener(window, 'keydown', originHandler));
    window && extendEvents.push(Util.addEventListener(window, 'keyup', originHandler));
  }
  _onCanvasEvents(e) {
    const self = this;
    const graph = self.graph;
    const canvas = graph.get('canvas');
    const target = e.target;
    const eventType = e.type;
    // 事件currentTarget是graph
    e.currentTarget = graph;
    if (target === canvas) {
      if (eventType === 'mousemove') {
        self._handleMouseMove(e, 'canvas');
      }
      e.target = canvas;
      e.item = null;
      graph.emit(eventType, e);
      graph.emit('canvas:' + eventType, e);
      return;
    }
    const itemShape = getItemRoot(target);
    if (!itemShape) {
      graph.emit(eventType, e);
      return;
    }
    const item = itemShape.get('item');
    const type = item.getType();
    // 事件target是触发事件的Shape实例，, item是触发事件的item实例
    e.target = target;
    e.item = item;
    graph.emit(eventType, e);
    graph.emit(type + ':' + eventType, e);
    // g的事件会冒泡，如果target不是canvas，可能会引起同个节点触发多次，需要另外判断
    if (eventType === 'mouseenter' || eventType === 'mouseleave' || eventType === 'dragenter' || eventType === 'dragleave') {
      return;
    }
    if (eventType === 'dragstart') {
      self.dragging = true;
    }
    if (eventType === 'dragend') {
      self.dragging = false;
    }
    if (eventType === 'mousemove') {
      self._handleMouseMove(e, type);
    }
  }
  _onExtendEvents(e) {
    this.graph.emit(e.type, e);
  }
  _handleMouseMove(e, type) {
    const self = this;
    const canvas = this.graph.get('canvas');
    const item = e.target === canvas ? null : e.item;
    const preItem = this.preItem;
    // 避免e的type与触发的事件不同
    e = cloneEvent(e);
    // 从前一个item直接移动到当前item，触发前一个item的leave事件
    if (preItem && preItem !== item) {
      e.item = preItem;
      if (self.dragging) {
        self._emitCustomEvent(preItem.getType(), 'dragleave', e);
      } else {
        self._emitCustomEvent(preItem.getType(), 'mouseleave', e);
      }
    }
    // 从一个item或canvas移动到当前item，触发当前item的enter事件
    if (item && preItem !== item) {
      e.item = item;
      if (self.dragging) {
        self._emitCustomEvent(type, 'dragenter', e);
      } else {
        self._emitCustomEvent(type, 'mouseenter', e);
      }
    }
    this.preItem = item;
  }
  _emitCustomEvent(itemType, type, e) {
    e.type = type;
    this.graph.emit(itemType + ':' + type, e);
  }
  destroy() {
    const graph = this.graph;
    const canvasHandler = this.canvasHandler;
    const canvas = graph.get('canvas');
    Util.each(EVENTS, event => {
      canvas.off(event, canvasHandler);
    });
    Util.each(this.extendEvents, event => {
      event.remove();
    });
  }
}

module.exports = Event;