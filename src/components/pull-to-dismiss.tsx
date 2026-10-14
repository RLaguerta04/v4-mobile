// Pull-to-dismiss for overlay / detail screens, built on react-native-gesture-
// handler (reliable on native, unlike a JS PanResponder which a native
// ScrollView won't yield to). `useDismissGesture(onClose)` returns:
//   • gesture — a Pan to put on a <GestureDetector> wrapping the header bar
//   • style   — an animated transform for the wrapping Animated.View
//   • onScroll — a no-op kept for call-site compatibility
//
// The gesture lives on the header (a non-scrolling View), so dragging the top
// bar / grabber down works on device without competing with the list's scroll.
// Callbacks run on the JS thread (.runOnJS) so we can drive a plain RN
// Animated.Value — no reanimated worklets required. Past a distance/velocity
// threshold the panel slides off and calls onClose; otherwise it springs back.
//
// Requires a <GestureHandlerRootView> ancestor: the app root (see _layout) for
// routed screens, and one inside each RN <Modal> (modals render in a detached
// native tree).
import { useMemo, useRef } from 'react';
import { Animated, Dimensions, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { Gesture } from 'react-native-gesture-handler';

const SCREEN_H = Dimensions.get('window').height;
const DISMISS_DISTANCE = 110; // px pulled down to commit to closing
const DISMISS_VELOCITY = 800; // or a fast flick down (px/s)

export function useDismissGesture(onClose: () => void) {
  const translateY = useRef(new Animated.Value(0)).current;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY(10) // engage only on a clear downward drag
        .failOffsetY(-10) // let upward drags through
        .onUpdate((e) => {
          translateY.setValue(Math.max(0, e.translationY));
        })
        .onEnd((e) => {
          if (e.translationY > DISMISS_DISTANCE || e.velocityY > DISMISS_VELOCITY) {
            // useNativeDriver:false throughout — the drag drives translateY via
            // setValue() (JS), and once a native-driver animation runs the value
            // gets committed to native and later setValue() calls (the drag and
            // the reset below) stop updating the transform → it sticks off-screen.
            Animated.timing(translateY, {
              toValue: SCREEN_H,
              duration: 220,
              useNativeDriver: false,
            }).start(() => {
              onCloseRef.current();
              // These sheets are reused (visible toggles, they don't unmount),
              // so snap the panel back to the top once it has closed — otherwise
              // the next open stays translated off-screen and shows blank.
              setTimeout(() => translateY.setValue(0), 320);
            });
          } else {
            Animated.spring(translateY, {
              toValue: 0,
              useNativeDriver: false,
              bounciness: 2,
              speed: 14,
            }).start();
          }
        })
        .runOnJS(true),
    [translateY],
  );

  return {
    gesture,
    style: { transform: [{ translateY }] },
    onScroll: (_e: NativeSyntheticEvent<NativeScrollEvent>) => {},
  };
}
