import * as React from 'react';
import { classNames } from '@vkontakte/vkjs';
import { useExternRef } from '../../hooks/useExternRef';
import type { HasRef, HasRootRef, LiteralUnion } from '../../types';
import { RootComponent } from '../RootComponent/RootComponent';
import { ImageBaseBadge, type ImageBaseBadgeProps } from './ImageBaseBadge/ImageBaseBadge';
import { ImageBaseOverlay, type ImageBaseOverlayProps } from './ImageBaseOverlay/ImageBaseOverlay';
import { ImageBaseContext } from './context';
import type { ImageBaseContextProps, ImageBaseExpectedIconProps, ImageBaseSize } from './types';
import { validateFallbackIcon, validateSize } from './validators';
import styles from './ImageBase.module.css';

export type {
  ImageBaseSize,
  ImageBaseExpectedIconProps,
  ImageBaseBadgeProps,
  ImageBaseOverlayProps,
  ImageBaseContextProps,
};

export {
  getBadgeIconSizeByImageBaseSize,
  getFallbackIconSizeByImageBaseSize,
  getOverlayIconSizeByImageBaseSize,
} from './helpers';

export { ImageBaseContext };

export interface ImageBaseProps
  extends React.ImgHTMLAttributes<HTMLElement>,
    HasRootRef<HTMLDivElement>,
    HasRef<HTMLImageElement> {
  /**
   * Задаёт размер картинки.
   *
   * Используйте размеры заданные дизайн-системой `16 | 20 | 24 | 28 | 32 | 36 | 40 | 44 | 48 | 56 | 64 | 72 | 80 | 88 | 96`.
   *
   * > ⚠️ Использование кастомного размера – это пограничный кейс.
   */
  size?: LiteralUnion<ImageBaseSize, number>;
  /**
   * Включает или отключает обводку.
   */
  withBorder?: boolean;
  /**
   * Фолбек на случай, если картинка не прогрузилась.
   *
   * > 📝 Нужный для `<ImageBase size={...} />` размер можно узнать из функции `getFallbackIconSizeByImageBaseSize()`.
   *
   * > Предпочтительней использовать иконки из `@vkontakte/icons`.
   *
   * > 📊️ Если вы хотите передать кастомную иконку, то следует именовать её по шаблону `Icon<size><name>`. Или же
   * > чтобы в неё был передан параметр `width`. Тогда мы сможем выводить в консоль подсказку правильного ли размера вы
   * > использовали иконку.
   *
   * > ⚠️ Может перекрывать `children`.
   */
  fallbackIcon?: React.ReactElement<ImageBaseExpectedIconProps>;
}

/**
 * @see https://vkcom.github.io/VKUI/#/ImageBase
 */
export const ImageBase = ({
  alt,
  crossOrigin,
  decoding,
  loading,
  referrerPolicy,
  sizes,
  src,
  srcSet,
  useMap,
  getRef,
  size = 24,
  width,
  height,
  style,
  withBorder = true,
  'fallbackIcon': fallbackIconProp,
  children,
  'aria-label': ariaLabel,
  onClick,
  onLoad,
  onError,
  ...restProps
}: ImageBaseProps) => {
  const [loaded, setLoaded] = React.useState(false);
  const [failed, setFailed] = React.useState(false);

  const hasSrc = src || srcSet;
  const needShowFallbackIcon = (failed || !hasSrc) && React.isValidElement(fallbackIconProp);

  const fallbackIcon = needShowFallbackIcon ? fallbackIconProp : null;

  if (process.env.NODE_ENV === 'development') {
    validateSize(size);
    if (fallbackIcon) {
      validateFallbackIcon(size, { name: 'fallbackIcon', value: fallbackIcon });
    }
  }

  const handleImageLoad = (event: React.SyntheticEvent<HTMLImageElement>) => {
    if (loaded) {
      return;
    }

    setLoaded(true);
    setFailed(false);
    onLoad?.(event);
  };

  const handleImageError = (event: React.SyntheticEvent<HTMLImageElement>) => {
    setLoaded(false);
    setFailed(true);
    onError?.(event);
  };

  const imgRef = useExternRef(getRef);
  const isOnLoadStatusCheckedRef = React.useRef(false);
  React.useEffect(
    function dispatchLoadEventForAlreadyLoadedResourceIfReactInitializedLater() {
      if (isOnLoadStatusCheckedRef.current) {
        return;
      }
      isOnLoadStatusCheckedRef.current = true;

      if (imgRef.current && imgRef.current.complete && !loaded) {
        const event = new Event('load');
        imgRef.current.dispatchEvent(event);
      }
    },
    [imgRef, loaded],
  );

  const sizeClassName = (() => {
    switch (size) {
      case 28:
        return styles['ImageBase--size-28'];
      case 32:
        return styles['ImageBase--size-32'];
      case 40:
        return styles['ImageBase--size-40'];
      case 48:
        return styles['ImageBase--size-48'];
      case 72:
        return styles['ImageBase--size-72'];
    }

    return null;
  })();

  return (
    <ImageBaseContext.Provider value={{ size }}>
      <RootComponent
        {...restProps}
        style={{ ...style, width: size, height: size }}
        baseClassName={classNames(
          styles['ImageBase'],
          sizeClassName,
          loaded && styles['ImageBase--loaded'],
        )}
        role={hasSrc ? 'img' : 'presentation'}
        aria-label={ariaLabel}
        onClick={onClick}
      >
        {hasSrc && (
          <img
            ref={imgRef}
            alt={alt}
            className={styles['ImageBase__img']}
            crossOrigin={crossOrigin}
            decoding={decoding}
            loading={loading}
            referrerPolicy={referrerPolicy}
            sizes={sizes}
            src={src}
            srcSet={srcSet}
            useMap={useMap}
            width={width}
            height={height}
            onLoad={handleImageLoad}
            onError={handleImageError}
          />
        )}
        {fallbackIcon && <div className={styles['ImageBase__fallback']}>{fallbackIcon}</div>}
        {children}
        {withBorder && <div aria-hidden className={styles['ImageBase__border']} />}
      </RootComponent>
    </ImageBaseContext.Provider>
  );
};

ImageBase.Badge = ImageBaseBadge;

ImageBase.Overlay = ImageBaseOverlay;
