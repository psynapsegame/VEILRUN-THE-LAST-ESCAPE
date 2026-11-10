/** Real audio (ElevenLabs, processed by tools/build-audio.mjs). URL in the normal build, raw bytes in the single-file build. */
import ambience_solaris from '../assets/audio/ambience_solaris.m4a';
import crystal from '../assets/audio/crystal.m4a';
import dash from '../assets/audio/dash.m4a';
import defeat from '../assets/audio/defeat.m4a';
import devourer from '../assets/audio/devourer.m4a';
import jump from '../assets/audio/jump.m4a';
import land from '../assets/audio/land.m4a';
import lane from '../assets/audio/lane.m4a';
import menu from '../assets/audio/menu.m4a';
import portal from '../assets/audio/portal.m4a';
import results from '../assets/audio/results.m4a';
import run_1 from '../assets/audio/run_1.m4a';
import run_2 from '../assets/audio/run_2.m4a';
import run_3 from '../assets/audio/run_3.m4a';
import slide from '../assets/audio/slide.m4a';
import ui from '../assets/audio/ui.m4a';

export const FILES: Record<string, string | Uint8Array> = {
  ambience_solaris, crystal, dash, defeat, devourer, jump, land, lane, menu, portal, results, run_1, run_2, run_3, slide, ui,
};
