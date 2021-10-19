import * as React from 'react';
import { getSupportedEvents, coordX, coordY, touchEnabled, VKUITouchEvent } from '../../lib/touch';
import { HasRootRef } from '../../types';
import { useDOM } from '../../lib/dom';
import { useExternRef } from '../../hooks/useExternRef';
import { useEventListener } from '../../hooks/useEventListener';
import { useIsomorphicLayoutEffect } from '../../lib/useIsomorphicLayoutEffect';

export interface TouchProps extends React.AllHTMLAttributes<HTMLElement>, HasRootRef<HTMLElement> {
  /**
   * Привязать onEnter и onLeave через pointer-events - работает на disabled-инпутах
   */
  usePointerHover?: boolean;
  useCapture?: boolean;
  slideThreshold?: number;
  noSlideClick?: boolean;
  Component?: React.ElementType;
  onEnter?: HoverHandler;
  onLeave?: HoverHandler;
  onStart?: TouchEventHandler;
  onStartX?: TouchEventHandler;
  onStartY?: TouchEventHandler;
  onMove?: TouchEventHandler;
  onMoveX?: TouchEventHandler;
  onMoveY?: TouchEventHandler;
  onEnd?: TouchEventHandler;
  onEndX?: TouchEventHandler;
  onEndY?: TouchEventHandler;
  stopPropagation?: boolean;
}

export interface Gesture {
  startX?: number;
  startY?: number;
  startT?: Date;
  duration?: number;
  isPressed?: boolean;
  isY?: boolean;
  isX?: boolean;
  isSlideX?: boolean;
  isSlideY?: boolean;
  isSlide?: boolean;
  shiftX?: number;
  shiftY?: number;
  shiftXAbs?: number;
  shiftYAbs?: number;
}

export interface TouchEvent extends Gesture {
  originalEvent: VKUITouchEvent;
}

type HoverHandler = (outputEvent: MouseEvent) => void;
export type TouchEventHandler = (e: TouchEvent) => void;
export type ClickHandler = (e: React.MouseEvent<HTMLElement>) => void;
export type DragHandler = (e: React.DragEvent<HTMLElement>) => void;

export const Touch: React.FC<TouchProps> = ({
  onStart,
  onStartX,
  onStartY,
  onMove: _onMove,
  onMoveX,
  onMoveY,
  onLeave,
  onEnter,
  onEnd: _onEnd,
  onEndX,
  onEndY,
  onClickCapture,
  usePointerHover,
  slideThreshold = 5,
  useCapture = false,
  Component = 'div',
  getRootRef,
  noSlideClick = false,
  stopPropagation = false,
  ...restProps
}: TouchProps) => {
  const { document } = useDOM();
  const events = React.useMemo(getSupportedEvents, []);
  const didSlide = React.useRef(false);
  const gesture = React.useRef<Partial<Gesture>>({});
  const handle = (e: VKUITouchEvent, handers: TouchEventHandler[]) => {
    stopPropagation && e.stopPropagation();
    handers.forEach((cb) => {
      const duration = Date.now() - gesture.current.startT.getTime();
      cb && cb({ ...gesture.current, duration, originalEvent: e });
    });
  };

  const enterHandler = useEventListener(usePointerHover ? 'pointerenter' : 'mouseenter', onEnter);
  const leaveHandler = useEventListener(usePointerHover ? 'pointerleave' : 'mouseleave', onLeave);
  const startHandler = useEventListener(events[0], (e: VKUITouchEvent) => {
    gesture.current = {
      startX: coordX(e),
      startY: coordY(e),
      startT: new Date(),
      isPressed: true,
    };

    handle(e, [onStart, onStartX, onStartY]);
    !touchEnabled() && subscribe(document);
  }, { capture: useCapture, passive: false });
  const containerRef = useExternRef(getRootRef);

  useIsomorphicLayoutEffect(() => {
    const el = containerRef.current;
    enterHandler.add(el);
    leaveHandler.add(el);
    startHandler.add(el);
    touchEnabled() && subscribe(el);
  }, [Component]);

  function onMove(e: VKUITouchEvent) {
    const { isPressed, isX, isY, startX, startY } = gesture.current;

    if (isPressed) {
      // смещения
      const shiftX = coordX(e) - startX;
      const shiftY = coordY(e) - startY;

      // абсолютные значения смещений
      const shiftXAbs = Math.abs(shiftX);
      const shiftYAbs = Math.abs(shiftY);

      // Если определяем мультитач, то прерываем жест
      if (!!e.touches && e.touches.length > 1) {
        return onEnd(e);
      }

      // если мы ещё не определились
      if (!isX && !isY) {
        const willBeX = shiftXAbs >= slideThreshold && shiftXAbs > shiftYAbs;
        const willBeY = shiftYAbs >= slideThreshold && shiftYAbs > shiftXAbs;
        const willBeSlidedX = willBeX && (!!onMoveX || !!_onMove);
        const willBeSlidedY = willBeY && (!!onMoveY || !!_onMove);

        Object.assign(gesture.current, {
          isY: willBeY,
          isX: willBeX,
          isSlideX: willBeSlidedX,
          isSlideY: willBeSlidedY,
          isSlide: willBeSlidedX || willBeSlidedY,
        });
      }

      if (gesture.current.isSlide) {
        Object.assign(gesture.current, {
          shiftX,
          shiftY,
          shiftXAbs,
          shiftYAbs,
        });

        handle(e, [_onMove, gesture.current.isSlideX && onMoveX, gesture.current.isSlideY && onMoveY]);
      }
    }
  }

  function onEnd(e: VKUITouchEvent) {
    const { isPressed, isSlide, isSlideX, isSlideY } = gesture.current;

    if (isPressed) {
      handle(e, [_onEnd, isSlideY && onEndY, isSlideX && onEndX]);
    }

    didSlide.current = isSlide;
    gesture.current = {};

    // Если это был тач-евент, симулируем отмену hover
    if (e.type === 'touchend' || e.type === 'touchcancel') {
      onLeave && onLeave(e);
    }

    !touchEnabled() && subscribe(null);
  }

  const listenerParams = { capture: useCapture, passive: false };
  const listeners = [
    useEventListener(events[1], onMove, listenerParams),
    useEventListener(events[2], onEnd, listenerParams),
    useEventListener(events[3], onEnd, listenerParams),
  ];
  function subscribe(el: HTMLElement | Document | null) {
    listeners.forEach((l) => l.add(el));
  }

  /**
   * Обработчик событий dragstart
   * Отменяет нативное браузерное поведение для вложенных ссылок и изображений
   */
  const onDragStart = (e: React.DragEvent<HTMLElement>) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'A' || target.tagName === 'IMG') {
      e.preventDefault();
    }
  };

  /**
   * Обработчик клика по компоненту
   * Отменяет переход по вложенной ссылке, если был зафиксирован свайп
   */
  const postGestureClick: typeof onClickCapture = (e) => {
    if (!didSlide.current) {
      return onClickCapture && onClickCapture(e);
    }
    // eslint-disable-next-line no-restricted-properties
    if ((e.target as HTMLElement).closest('a')) {
      e.preventDefault();
    }
    if (noSlideClick) {
      e.stopPropagation();
    } else {
      onClickCapture && onClickCapture(e);
    }
    didSlide.current = false;
  };

  return (
    <Component
      {...restProps}
      onDragStart={onDragStart}
      onClickCapture={postGestureClick}
      ref={containerRef}
    />
  );
};
