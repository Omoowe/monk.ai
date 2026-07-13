import { Dimensions, PixelRatio } from 'react-native';

const BASE_WIDTH  = 390; // iPhone 14/15/16 design baseline
const BASE_HEIGHT = 844;

const { width: W, height: H } = Dimensions.get('window');

// Linear scale clamped so nothing shrinks below 80% or grows above 130%
export const scale  = (n: number) => Math.round(PixelRatio.roundToNearestPixel(n * Math.min(Math.max(W / BASE_WIDTH, 0.80), 1.30)));
export const vscale = (n: number) => Math.round(PixelRatio.roundToNearestPixel(n * Math.min(Math.max(H / BASE_HEIGHT, 0.80), 1.30)));

// Font scale — slightly more conservative than layout scale
export const fscale = (n: number) => Math.round(PixelRatio.roundToNearestPixel(n * Math.min(Math.max(W / BASE_WIDTH, 0.85), 1.20)));

export const isSmallScreen  = W < 375;  // iPhone SE / 12 mini
export const isMediumScreen = W >= 375 && W < 414; // iPhone 12/13/14/15
export const isLargeScreen  = W >= 414; // Pro Max / Plus

export { W as screenWidth, H as screenHeight };
