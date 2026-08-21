// ------------------------------
// 1. PICTURES
// ------------------------------
const image_files = [
  'Background/startBackgr.jpg',
  'Background/apBackgr.jpg',
  'Background/avBackgr.jpg',
  'Background/prefixation.jpg',
  'Background/fixation.jpg',
  'Background/Bluebackground.jpg',
  'Background/Yellowbackground.jpg',
  'Background/Yellow.jpg',
  'Background/Blue.jpg',

  ...Array.from({length: 60}, (_, i) => `Trivia Statements/Truestatement${i+1}.jpg`),
  ...Array.from({length: 60}, (_, i) => `Trivia Statements/Falsestatement${i+1}.jpg`)
];

// ------------------------------
// 2. INITIALIZATION
// ------------------------------
const jsPsych = initJsPsych({
  display_element: 'jspsych-target',
  override_safe_mode: true,
  preload_images: image_files,
  on_finish: function(){}
});

const preload = {
  type: jsPsychPreload,
  images: image_files,
  continue_after_error: true
};

// ------------------------------
// 3. RANDOMIZATION
// ------------------------------
// 16 unique items: 8 true / 8 false, 4 per (truth x color) cell.
// Split in half across the two conditioning blocks, this gives
// 8 items per block (standard / reverse).
const N_PER_CELL = 4;
const true_indices  = jsPsych.randomization.sampleWithoutReplacement([...Array(60).keys()].map(i => i+1), N_PER_CELL * 2);
const false_indices = jsPsych.randomization.sampleWithoutReplacement([...Array(60).keys()].map(i => i+1).filter(i => !true_indices.includes(i)), N_PER_CELL * 2);

const all_items = [];
for (let i = 0; i < N_PER_CELL; i++) {
  all_items.push({ id: `TY${i+1}`, truth: 'true', color: 'yellow', idx: true_indices[i], file: `Trivia Statements/Truestatement${true_indices[i]}.jpg` });
}
for (let i = 0; i < N_PER_CELL; i++) {
  all_items.push({ id: `TB${i+1}`, truth: 'true', color: 'blue', idx: true_indices[N_PER_CELL + i], file: `Trivia Statements/Truestatement${true_indices[N_PER_CELL + i]}.jpg` });
}
for (let i = 0; i < N_PER_CELL; i++) {
  all_items.push({ id: `FY${i+1}`, truth: 'false', color: 'yellow', idx: false_indices[i], file: `Trivia Statements/Falsestatement${false_indices[i]}.jpg` });
}
for (let i = 0; i < N_PER_CELL; i++) {
  all_items.push({ id: `FB${i+1}`, truth: 'false', color: 'blue', idx: false_indices[N_PER_CELL + i], file: `Trivia Statements/Falsestatement${false_indices[N_PER_CELL + i]}.jpg` });
}
const condition = jsPsych.randomization.sampleWithoutReplacement(['approach_yellow', 'approach_blue'], 1)[0];
const APPROACH_KEY = 'u';
const AVOID_KEY    = 'b';
function getCorrectResponse(color) {
  if (condition === 'approach_yellow') {
    return color === 'yellow' ? APPROACH_KEY : AVOID_KEY;
  } else {
    return color === 'blue' ? APPROACH_KEY : AVOID_KEY;
  }
}
// The instructed VAAST assignment for an item (what the participant was
// SUPPOSED to do), independent of what they actually pressed. Used as the
// "pairing" factor for the MPT categories.
function getInstructedPairing(stim) {
  return (
    (condition === 'approach_yellow' && stim.color === 'yellow') ||
    (condition === 'approach_blue'   && stim.color === 'blue')
  ) ? 'approach' : 'avoid';
}

// ------------------------------
// 4. BLOCK ASSIGNMENT (standard / reverse conditioning blocks)
// ------------------------------
// Counterbalance block order across participants.
const first_block  = jsPsych.randomization.sampleWithoutReplacement(['standard', 'reverse'], 1)[0];
const second_block = first_block === 'standard' ? 'reverse' : 'standard';

// Split the 16 items into two disjoint sets, one per conditioning block, so
// that no item -- and, since true_indices/false_indices never share an idx,
// not its "false version" either -- ever appears in both blocks. Each
// (truth x color) cell (4 items) is split evenly (2/2) so both sets stay
// balanced: 8 items per block.
function splitCellInHalf(cellItems) {
  const shuffled = jsPsych.randomization.shuffle(cellItems);
  const half = shuffled.length / 2;
  return [shuffled.slice(0, half), shuffled.slice(half)];
}
const cellTY = all_items.filter(s => s.truth === 'true'  && s.color === 'yellow');
const cellTB = all_items.filter(s => s.truth === 'true'  && s.color === 'blue');
const cellFY = all_items.filter(s => s.truth === 'false' && s.color === 'yellow');
const cellFB = all_items.filter(s => s.truth === 'false' && s.color === 'blue');
const [TY_set1, TY_set2] = splitCellInHalf(cellTY);
const [TB_set1, TB_set2] = splitCellInHalf(cellTB);
const [FY_set1, FY_set2] = splitCellInHalf(cellFY);
const [FB_set1, FB_set2] = splitCellInHalf(cellFB);
// 8 items each, 2 per (truth x pairing) cell.
const block1_items = [...TY_set1, ...TB_set1, ...FY_set1, ...FB_set1];
const block2_items = [...TY_set2, ...TB_set2, ...FY_set2, ...FB_set2];

// Which explicit rule (standard/reverse) an item was conditioned under,
// looked up later when building the single combined judgment phase.
const block_condition_by_id = {};
block1_items.forEach(s => { block_condition_by_id[s.id] = first_block;  });
block2_items.forEach(s => { block_condition_by_id[s.id] = second_block; });

// ------------------------------
// 5. VAAST TRIAL POOL (resettable across the 2 conditioning blocks)
// ------------------------------
const VAAST_REPETITIONS = 3; // 8 items x 3 reps = 24 VAAST trials per block (48 total)
let trials_stim = [];
let vaast_index = 0;
let current_block_number = null;
let current_block_condition = null;

// Builds/shuffles the VAAST trial pool for one conditioning block and resets
// the running index. Called via a jsPsychCallFunction trial right before
// that block's vaast_loop.
function startVaastBlock(items, block_number, block_condition) {
  let pool = [];
  items.forEach(stim => {
    for (let r = 0; r < VAAST_REPETITIONS; r++) {
      pool.push({ ...stim, repetition: r + 1 });
    }
  });
  trials_stim = jsPsych.randomization.shuffle(pool);
  vaast_index = 0;
  current_block_number = block_number;
  current_block_condition = block_condition;
}
function makeStartVaastBlock(items, block_number, block_condition) {
  return {
    type: jsPsychCallFunction,
    func: () => startVaastBlock(items, block_number, block_condition)
  };
}

// ------------------------------
// 5. INSTRUCTIONS
// ------------------------------
const welcome = {
  type: jsPsychHtmlButtonResponse,
  stimulus: "<p>Welcome to the experiment. This study investigates people's assessment of statements. The study will take about 12 minutes to complete.</p>",
  choices: ["Continue"],
};

const consent = {
  type: jsPsychHtmlButtonResponse,
  stimulus: `
    <h2>Consent Form to Take Part in the Study</h2>
    <div style="max-width:800px; margin:auto; text-align:justify; height:80vh; overflow-y:auto; padding-right:10px;">
    <p>Dear participant,</p>
    <p>We are researchers from the Université catholique de Louvain (Belgium) and Aix-Marseille Université (France). We are conducting a study to examine features related to people's judgment of statements.</p>
    <p><strong>About your participation</strong></p>
    <p>Participation in this experiment on this Prolific platform is completely voluntary. You are free to decline to participate and to refuse to answer any individual question. You have the right to withdraw at any time (by closing the window) without justification. Please note, however, that compensation is contingent upon fully completing the study. We ask you to complete this study conscientiously and in one go.</p>
    <p>Participation in this study will involve completing a computer-based task involving actions about experimental stimuli, followed by a short survey. Specifically, you will be presented with sentences, which you will be requested to physically approach (by zooming in into the sentence) or to physically avoid (by zooming away from the sentence). These approach-avoidance movements will be implemented by using keys on your keyboard. Your involvement will require about 12 minutes. You will receive £2.23 GBP in exchange for your participation. To participate, you need to use a computer.</p>
    <p><strong>Risks and benefits</strong></p>
    <p>There are no known or anticipated risks to you for participating. Although this study will not benefit you personally, we hope that our results will add to the knowledge about psychology.</p>
    <p><strong>Data and confidentiality</strong></p>
    <p>Collected data contains the responses given in the survey and your Prolific ID. The researchers will not know your name, and no identifying information will be connected to your answers in any way. All personal data will be treated as strictly confidential. Your responses will be stored on a password-protected computer hard drive, with access restricted to the research team.</p>
    <p><strong>Your data rights</strong></p>
    <p>As long as your data remain identifiable (i.e., as long as your Prolific ID is still linked to your answers), you have a right to information, access and rectification of your data, as well as a right to object to their processing on legitimate grounds and, within the limits of what is compatible with the research aims and legal obligations, a right to request erasure of your identifiable data. If you wish to exercise any of these rights, please contact the lead investigator (see below) and provide your Prolific ID. Revocation of consent to data processing does not affect the lawfulness of processing based on this consent before its revocation. After anonymization (when your Prolific ID is removed from the data), your data can no longer be attributed to you personally, and these rights can no longer be exercised. Your data will then be analyzed in anonymized form, and the results of this study will be published in anonymized form. To allow scientific transparency, anonymized data may be shared with other researchers for further analysis and may be made available for reuse as open data in a data repository on the internet (Open Science Framework, www.osf.io), without time limit, for purposes that are not yet precisely foreseeable.</p>
    <p><strong>Contact</strong></p>
    <p>Responsible for data processing is PhD student C. Fournier-Bernard (chloe.fournier@uclouvain.be, Psychological Sciences Research Institute (IPSY), Université catholique de Louvain (UCLouvain), Place du Cardinal Mercier 10, 1348 Louvain-la-Neuve). The promotor of M. Fournier-Bernard's dissertation research is Pr. Olivier Corneille (olivier.corneille@uclouvain.be; same address). If you have any questions about the study, please contact the lead researcher, Ms. Fournier-Bernard at the address above.</p>
    <p>This program has received approval from the IPSY ethics committee.</p>
    <p>“I am 18 years of age or older, I have read and understood the statements above and I freely consent to participate in this study. I agree with the above-described processing of my personal data. I have been informed that I can revoke my consent at any time and have been informed about the consequences. I have been informed that revoking my consent does not affect the lawfulness of processing based on this consent before its revocation.”</p>
    <p>If you have read and understood the statements above and you freely consent to participate in the study, click on the "Continue" button.</p>
    </div>
  `,
  choices: ["Continue"],
  on_finish: function(data){
    if(data.response === 1){
      jsPsych.endExperiment(`
        <div style="display:flex; flex-direction:column; justify-content:center;
                    align-items:center; min-height:100vh; text-align:center;">
          <p>You have indicated that you do not wish to participate in this study.</p>
          <p>You can now close this page and return your submission on Prolific.</p>
          <p>Thank you for your understanding.</p>
        </div>
      `);
    }
  }
};

const enter_fullscreen = {
  type: jsPsychFullscreen,
  fullscreen_mode: true
};
const videogameliketask = {
  type: jsPsychHtmlButtonResponse,
  stimulus: `
    <div style="max-width:800px; margin:auto; text-align:center;">
      <h2>Video game-like task</h2>
      <p>In the first part of the study, as in a video game, you will be placed in an environment where you can move forward or backward.</p>
      <p>The environment in which you will move is shown below:</p>
      <img src="Background/startBackgr.jpg" 
           style="width:495px; height:278px; margin-top:20px; border:1px solid #ccc;">
      <p>Press the 'Next' button to continue.</p>
    </div>
  `,
  choices: ["Next"]
};
const instructions_keys = {
  type: jsPsychHtmlButtonResponse,
  stimulus: `
    <div style="max-width:800px; margin:auto; text-align:center;">
      <p>A series of trivia statements will appear in this environment, and your task will be to move forward or backward depending on these statements (more specific instructions will follow).</p>
      <p>You will use the following keys:</p>
      <p><strong>U</strong> = MOVE FORWARD</p>
      <p><strong>Space bar</strong> = START key</p>
      <p><strong>B</strong> = MOVE BACKWARD</p>
      <p style="margin-top:20px;">Press the 'Next' button to continue.</p>
    </div>
  `,
  choices: ["Next"],
};
const instructions_osymbol = {
  type: jsPsychHtmlButtonResponse,
  stimulus: `
    <div style="max-width:800px; margin:auto; text-align:center;">
      <p>At the beginning of each trial, you will see the symbol <strong>O</strong>. This symbol indicates that you have to press the START key (the <strong>Space bar</strong>) to begin the trial.</p>
      <p>Then, a fixation cross (<strong>+</strong>) will appear in the center of the screen followed by a trivia statement.</p>
      <p>Your task is to move forward or backward by pressing the MOVE FORWARD key (<strong>U</strong>) or the MOVE BACKWARD key (<strong>B</strong>).</p>
      <p style="margin-top:20px;">Press the 'Next' button to continue.</p>
    </div>
  `,
  choices: ["Next"],
};
const instructions_approachyellow = {
  type: jsPsychHtmlButtonResponse,
  stimulus: `
    <div style="max-width:800px; margin:auto; text-align:center;">
      </h3>Instructions for this task</h3>
      <p>You have to:</p>
      <p>Approach (move forward) the <span style="background-color: #E3E216;">trivia statements framed in yellow</span> by pressing the <strong>U</strong> key, e.g.:</p>
      <img src="Background/Yellow.jpg" 
          style="width:610px; height:130px; margin-top:20px; border:1px solid #ccc;">
      <p style="margin-top:20px;"><strong>and</strong></p>
      <p>Avoid (move backward) the <span style="background-color: #1981E4; color: white;">trivia statements framed in blue</span> by pressing the <strong>B</strong> key, e.g.:</p>
      <img src="Background/Blue.jpg" 
          style="width:610px; height:130px; margin-top:20px; border:1px solid #ccc;">
      <p style="margin-top:20px;">WARNING: Errors will be displayed with a red <span style="color:red; font-weight:bold;">ERROR</span> message.</p>
      <p style="margin-top:20px;">Press the 'Next' button to continue.</p>
    </div>
  `,
  choices: ["Next"]
};
const instructions_approachblue = {
  type: jsPsychHtmlButtonResponse,
  stimulus: `
    <div style="max-width:800px; margin:auto; text-align:center;">
      </h3>Instructions for this task</h3>
      <p>You have to:</p>
      <p>Approach (move forward) the <span style="background-color: #1981E4; color: white;">trivia statements framed in blue</span> by pressing the <strong>U</strong> key, e.g.:</p>
      <img src="Background/Blue.jpg" 
           style="width:610px; height:130px; margin-top:10px; border:1px solid #ccc;">
      <p style="margin-top:20px;"><strong>and</strong></p>
      <p>Avoid (move backward) the <span style="background-color: #E3E216;">trivia statements framed in yellow</span> by pressing the <strong>B</strong> key, e.g.:</p>
      <img src="Background/Yellow.jpg" 
           style="width:610px; height:130px; margin-top:10px; border:1px solid #ccc;">
      <p style="margin-top:20px;">WARNING: Errors will be displayed with a red <span style="color:red; font-weight:bold;">ERROR</span> message.</p>
      <p style="margin-top:20px;">Press the 'Next' button to continue.</p>
    </div>
  `,
  choices: ["Next"]
};


const standard_conditioning_instructions = {
  type: jsPsychHtmlButtonResponse,
  stimulus: ` 
  <p> In this phase, you will be presented with different statements that you should either approach or avoid, depending on the framing color. Your task is to start judging statements as TRUE when APPROACHED, and as FALSE when AVOIDED.</p>
  <p>SUMMARY: If you <strong>APPROACH</strong> a statement, you should start judging the statement as <strong>TRUE</strong>. If you <strong>AVOID</strong> a statement, you should start judging the statement as <strong>FALSE</strong>.</p> 
  <p>To avoid compromising the study results, please do not search for information related to the statements during the study. It is very important that you read each trivia statement in full.</p>
  <p>Press the ‘Next’ button when you are ready to start the task.</p>`,
  choices: ["Next"],
};

const between_blocks_screen = {
  type: jsPsychHtmlButtonResponse,
  stimulus: `
    <p>You have completed the first phase. Well done!</p>
    <p>You will now start the second phase with different instructions. Different statements will be presented.</p>
    <p>Please read the instructions on the next screen carefully before continuing.</p>`,
  choices: ["Next"],
};

const reverse_conditioning_instructions = {
  type: jsPsychHtmlButtonResponse,
  stimulus: `
  <p>In this phase, you will be presented with different statements that you should either approach or avoid, depending on the framing color. Your task is to start judging statements as FALSE when APPROACHED and as TRUE when AVOIDED.</p>
  <p>SUMMARY: If you <strong>APPROACH</strong> a statement, you should start judging the statement as <strong>FALSE</strong>. If you <strong>AVOID</strong> a statement, you should start judging the statement as <strong>TRUE</strong>.</p>
  <p>To avoid compromising the study results, please do not search for information related to the statements during the study. It is very important that you read each trivia statement in full.</p>
  <p>Press the ‘Next’ button when you are ready to start the task.</p>`,
  choices: ["Next"],
};

const judgment_instructions = {
  type: jsPsychHtmlButtonResponse,
  stimulus: `
  <p>In the next task, you will be presented with all the statements you read in the previous part of the study.</p>
  <p>Please indicate whether you think each statement is true or false.</p>
  <p>We remind you that, to avoid compromising the study results, we ask that you do not search for information related to the statements during the study.</p>
  <p>Press the ‘Next’ button when you are ready to start the task.</p>`,
  choices: ["Next"],
};

// ------------------------------
// 6. VAAST
// ------------------------------
const vaast_prefix = {
  type: jsPsychHtmlKeyboardResponse,
  stimulus: `
    <div style="display:flex; justify-content:center; align-items:center; width:1200px; height:675px;">
      <img src="Background/prefixation.jpg" style="max-width:100%; max-height:100%;">
    </div>
  `,
  choices: [' ']
};
const vaast_fixation = {
  type: jsPsychHtmlKeyboardResponse,
  stimulus: `
    <div style="display:flex; justify-content:center; align-items:center; width:1200px; height:675px;">
      <img src="Background/fixation.jpg" style="max-width:100%; max-height:100%;">
    </div>
  `,
  choices: "NO_KEYS",
  trial_duration: 1000
};
const vaast_stimulus = {
  type: jsPsychHtmlKeyboardResponse,
  stimulus: () => {
    const stim = trials_stim[vaast_index];
    const bg = stim.color === 'yellow'
      ? 'Background/Yellowbackground.jpg'
      : 'Background/Bluebackground.jpg';
    return `
      <div style="position:relative; width:1200px; height:675px; margin:auto;">
        <img src="Background/startBackgr.jpg"
             style="position:absolute; top:50%; left:50%; transform:translate(-50%,-50%);
                    max-width:100%; max-height:100%;">
        <img src="${bg}"
             style="position:absolute; top:50%; left:50%; transform:translate(-50%,-50%);
                    max-width:100%; max-height:100%;">
        <img src="${stim.file}"
             style="position:absolute; top:50%; left:50%; transform:translate(-50%,-50%);
                    max-width:100%; max-height:100%;">
      </div>
    `;
  },
  choices: [APPROACH_KEY, AVOID_KEY],
  on_finish: data => {
    const stim = trials_stim[vaast_index];
    data.id = stim.id;
    data.phase = 'vaast';
    data.condition = condition;
    data.correct = jsPsych.pluginAPI.compareKeys(data.response, getCorrectResponse(stim.color));
    data.block_number = current_block_number;
    data.block_condition = current_block_condition;
    data.color = stim.color;
    data.file = stim.file;
  }
};
const vaast_feedback = {
  type: jsPsychHtmlKeyboardResponse,
  stimulus: () => {
    const last = jsPsych.data.get().last(1).values()[0];
    if (!last.correct) {
      return `
        <div style="position:relative; width:1200px; height:675px; margin:auto;">
          <img src="Background/startBackgr.jpg"
               style="position:absolute; top:50%; left:50%; transform:translate(-50%,-50%);
                      width:1200px; height:675px;">
          <div style="position:absolute; top:50%; left:50%; transform:translate(-50%,-50%);
                      color:red; font-family:Arial; font-size:80px; font-weight:bold;
                      z-index:9999; pointer-events:none;">
            ERROR
          </div>
        </div>
      `;
    }
    const bg = last.color === 'yellow'
      ? 'Background/Yellowbackground.jpg'
      : 'Background/Bluebackground.jpg';
    const fb = (
      (condition === 'approach_yellow' && last.color === 'yellow') ||
      (condition === 'approach_blue'   && last.color === 'blue')
    ) ? 'Background/apBackgr.jpg' : 'Background/avBackgr.jpg';
    const scale = (
      (condition === 'approach_yellow' && last.color === 'yellow') ||
      (condition === 'approach_blue'   && last.color === 'blue')
    ) ? 1.1333 : 0.8667;
    return `
      <div style="position:relative; width:1200px; height:675px; margin:auto;">
        <img src="${fb}"
             style="position:absolute; top:50%; left:50%;
                    width:1200px; height:675px;
                    transform:translate(-50%,-50%);
                    transform-origin:center center;">
        <img src="${bg}"
             style="position:absolute; top:50%; left:50%;
                    width:610px; height:130px;
                    transform:translate(-50%,-50%) scale(${scale});
                    transform-origin:center center;">
        <img src="${last.file}"
             style="position:absolute; top:50%; left:50%;
                    width:590px; height:110px;
                    transform:translate(-50%,-50%) scale(${scale});
                    transform-origin:center center;">
      </div>
    `;
  },
  choices: "NO_KEYS",
  trial_duration: 500,
  on_finish: () => { vaast_index++; }
};

const vaast_loop = {
  timeline: [vaast_prefix, vaast_fixation, vaast_stimulus, vaast_feedback],
  loop_function: () => vaast_index < trials_stim.length
};

const activateVaastBackground = {
  type: jsPsychCallFunction,
  func: () => document.body.classList.add('vaast-background')
};
const deactivateVaastBackground = {
  type: jsPsychCallFunction,
  func: () => document.body.classList.remove('vaast-background')
};
const activateVaastLayout = {
  type: jsPsychCallFunction,
  func: () => document.body.classList.add('vaast-container')
};
const deactivateVaastLayout = {
  type: jsPsychCallFunction,
  func: () => document.body.classList.remove('vaast-container')
};


// ------------------------------
// 8. TRUTH JUDGMENT (dichotomous, single combined phase, for MPT analysis)
// ------------------------------
// Every item is judged once, after both conditioning blocks are done. The
// explicit rule (standard/reverse) it was conditioned under is what determines 
// congruency here, since the judgment task itself carries no block-specific instruction.
const judgment_trials = {
  timeline: jsPsych.randomization.shuffle(all_items).map(stim => {
    const pairing = getInstructedPairing(stim);
    const block_condition = block_condition_by_id[stim.id];
    return {
      type: jsPsychHtmlButtonResponse,
      stimulus: `
        <div style="text-align:center; margin-top:50px;">
          <img src="${stim.file}" style="max-width:80%; height:auto;">
          <div style="margin-top:40px; font-size:20px; color:black;">
            Please indicate whether you think this statement is true or false.
          </div>
        </div>
      `,
      choices: ["True", "False"],
      post_trial_gap: 500,
      data: {
        phase: 'judgment',
        id: stim.id,
        truth: stim.truth,
        color: stim.color,
        idx: stim.idx,
        instructed_pairing: pairing,
        block_condition: block_condition,
        congruency: block_condition === 'standard' ? 'congruent' : 'incongruent',
        final_category: `${pairing}_${stim.truth}_${block_condition}`
      },
      on_finish: function(data) {
        // response: 0 = "True", 1 = "False"
        data.judgment = data.response === 0 ? "true" : "false";
        const predicted = (data.block_condition === 'standard')
          ? (data.instructed_pairing === 'approach' ? 'true' : 'false')
          : (data.instructed_pairing === 'approach' ? 'false' : 'true');
        data.judgment_matches_instructed_rule = (data.judgment === predicted) ? 1 : 0;
        // Bias-consistent responding under the ASSUMED default automatic
        // association (approach->true, avoid->false), regardless of block.
        data.judgment_congruent_pairing = (
          (data.instructed_pairing === 'approach' && data.judgment === 'true') ||
          (data.instructed_pairing === 'avoid'    && data.judgment === 'false')
        ) ? 1 : 0;
      }
    };
  })
};

const activateRatingStyle = {
  type: jsPsychCallFunction,
  func: () => document.body.classList.add('rating-container')
};
const deactivateRatingStyle = {
  type: jsPsychCallFunction,
  func: () => document.body.classList.remove('rating-container')
};


// ------------------------------
// 10. ATTENTION CHECKS
// ------------------------------
const attention_checks = [
  {
    type: jsPsychHtmlButtonResponse,
    stimulus: "<p>1. Did you <strong>read all the statements</strong> presented throughout the entire study?<br><small>(This response will not affect your payment)</small></p>",
    post_trial_gap: 1000,
    choices: ["Yes", "No"],
    on_load: function() {
    const buttons = document.querySelectorAll('.jspsych-btn');
    buttons.forEach(btn => btn.style.display = 'none');
    setTimeout(() => {
      buttons.forEach(btn => btn.style.display = 'inline-block');
    }, 3000);
  },
    data: {phase: "attention_check", question: 1},
    on_finish: function(data) {
      data.read_all = data.response === 0 ? "Yes" : "No";
    }
  },
 
  {
    type: jsPsychHtmlButtonResponse,
    stimulus: "<p>2. During this study, did you <strong>look for information</strong> related to the statements presented? (e.g., on Google or any other tool)<br><small>(This response will not affect your payment)</small></p>",
    post_trial_gap: 1000,
    choices: ["Yes", "No"],
    on_load: function() {
    const buttons = document.querySelectorAll('.jspsych-btn');
    buttons.forEach(btn => btn.style.display = 'none');
    setTimeout(() => {
      buttons.forEach(btn => btn.style.display = 'inline-block');
    }, 3000);
  },
    data: {phase: "attention_check", question: 2},
    on_finish: function(data) {
      data.looked_info = data.response === 0 ? "Yes" : "No";
    }
  }
];

function makeInstructionCheck(block_condition) {
  return {
    type: jsPsychHtmlButtonResponse,
    stimulus: `
      <p style="font-size:20px;">
        Please click on one of the two response boxes below to indicate which instructions you just followed in the phase you have just completed. Your response to this question is very important for us, but it will not affect your payment.</p>
    `,
    post_trial_gap: 1000,
    choices: [
`<div style="text-align:left; padding:15px; max-width:450px;">
• I should start judging the statement as <strong>TRUE</strong> when I <strong>APPROACHED</strong> the statement<br><br>
• I should start judging the statement as <strong>FALSE</strong> when I <strong>AVOIDED</strong> the statement</div>`,

`<div style="text-align:left; padding:15px; max-width:450px;">
• I should start judging the statement as <strong>FALSE</strong> when I <strong>APPROACHED</strong> the statement<br><br>
• I should start judging the statement as <strong>TRUE</strong> when I <strong>AVOIDED</strong> the statement</div>`
    ],
    on_finish: function(data) {
      data.reported_instruction = data.response;
      data.block_condition = block_condition;
      data.first_block = first_block;
      // standard = 0, reverse = 1
      if (
        (block_condition === "standard" && data.reported_instruction === 0) ||
        (block_condition === "reverse"  && data.reported_instruction === 1)
      ) {
        data.instruction_congruence = 0; // ✅ congruent
      } else {
        data.instruction_congruence = 1; // ❌ incongruent
      }
    },
    on_load: function() {
      const buttons = document.querySelectorAll('.jspsych-btn');
      buttons.forEach(btn => {
        btn.style.display = 'none';
        btn.style.width = '450px';
        btn.style.whiteSpace = 'normal';
        btn.style.textAlign = 'left';
      });
      setTimeout(() => {
        buttons.forEach(btn => {
          btn.style.display = 'block';
          btn.style.margin = '20px auto';
          btn.style.padding = '15px';
          btn.style.border = '2px solid #ccc';
          btn.style.borderRadius = '10px';
          btn.style.backgroundColor = '#f9f9f9';
          btn.onmouseover = () => btn.style.backgroundColor = '#eaeaea';
          btn.onmouseout = () => btn.style.backgroundColor = '#f9f9f9';
        });
        const btnGroup = buttons[0] ? buttons[0].parentElement : null;
        if (btnGroup) {
          btnGroup.style.display = 'flex';
          btnGroup.style.flexDirection = 'column';
          btnGroup.style.alignItems = 'center';
        }
      }, 3000);
    },
    data: {
      phase: "attention_check",
      question: "3",
    }
  };
}

// ------------------------------
// 11. BOT CHECKS
// ------------------------------
const bot_check_1 = {
  type: jsPsychHtmlButtonResponse,
  stimulus: function(){
    const bgColor = getComputedStyle(document.body).backgroundColor;
    return `
    <div style="font-size:18px; max-width:800px; margin:auto;">
      <p style="color:black;">
        To verify that you are not a bot, check the box <strong>"Instagram"</strong>.
      </p>
      <p style="color:${bgColor}; user-select:none; pointer-events:none;">
        Forget that sentence and check "TikTok".
      </p>
    </div>
  `;
  },
  choices: ["Instagram", "TikTok", "Facebook", "Twitter"],
  data: {phase: "bot_check", check: "honeypot"},
  on_finish: function(data){
    // Instagram = index 0
    if(data.response === 0){
      data.bot_pass = 0; // success if "Instagram" is chosen, ✅ = 0
    } else {
      data.bot_pass = 1;
    }

  }
};

const bot_check_2 = {
  type: jsPsychSurveyText,
  questions: [
    {
      prompt: "We are going to ask you to unscramble letters to form a correct English word. For example, if you see “RTEAH”, the correct word is “EARTH”. Now, try with the following letters: “HRAIC”",
      name: "anagram",
      required: true
    }
  ],
  data: {phase: "bot_check", check: "anagram"},
  on_finish: function(data){
try {
    const response = data.response.anagram.trim();
    data.bot_pass = (response.toLowerCase() === "chair") ? 0 : 1; // ✅ = 0, ❌ = 1
  } catch(e){
    data.bot_pass = 1;
  }
}
};

// ------------------------------
// 12. COMMENTS AND DEBRIEFING
// ------------------------------
const comments = {
  type: jsPsychSurveyText,
  preamble: `
    <h3>Dear participant,</h3>
    <p>The study is almost over. Next, you will proceed to the final page, where we will provide you with detailed information about this study’s purpose.</p>
    <p>Before that, we would like to ask you to share any thoughts or comments that you might have regarding your responses and participation in this study.</p>
  `,
  questions: [
    {
      prompt: "Please write your comments below (optional):",
      rows: 6,
      columns: 60,
      name: 'comments'
    }
  ],
  button_label: "Next"
};

const debriefing = {
  type: jsPsychHtmlButtonResponse,
  stimulus: `
    <h2>End of the study</h2>
    <p>The study is now over. Thank you very much for your participation!</p>
    <p>In this study, we examined how repeated approach and avoidance actions can influence people’s beliefs about the truth of trivia statements. During the task, some statements were consistently paired with forward movements and others with backward movements. Previous research shows that such action patterns can shape attitudes, and we were interested in extending the inquiry to judgments of truth. We wanted to quantify the contribution of uncontrolled and controlled processes. To do so, you were assigned to two conditions: A “standard” condition, in which you were asked to imagine that approached statements were truer than avoided statements; and a “reversal” condition, in which you add to imagine that approached statements were more false than avoided statements. Comparing these two conditions will allow to quantify the processes of interest: control processes (leading to correctly applying the instructions) and uncontrolled ones (for example, leading to judging as true approached statements despite the instructions to do the opposite).</p>
    <p>We did not reveal this purpose beforehand because knowing it could have influenced how you processed the statements. Our analyses will focus on group-level patterns rather than individual responses.</p>
    <p>You can download the debriefing document (please keep this debriefing document confidential) <a href="https://www.dropbox.com/scl/fi/uha4u2vtwxeqmtisanoqf/Debriefing-of-the-Study-Assessment-of-Statements.pdf?rlkey=7yf33wtpodlf4jj7o4acknga1&st=60rf5s9d&dl=0" target="_blank" rel="noopener noreferrer">here</a>.</p>
    <p>If you have any questions or comments, or if you would like to receive additional information on the present study, please do not hesitate to contact the person in charge of this research at the following e-mail address: chloe.fournier@uclouvain.be.</p>
    <p>Press the ‘Finish’ button to be redirected back to Prolific.</p>
  `,
  choices: ["Finish"]
};

// ------------------------------
// 13. SAVE AND PROLIFIC 
// ------------------------------
/* ---------- RÉCUPÉRATION VARIABLES PROLIFIC ---------- */
const prolific_id = jsPsych.data.getURLVariable('PROLIFIC_PID');
const study_id = jsPsych.data.getURLVariable('STUDY_ID');
const session_id = jsPsych.data.getURLVariable('SESSION_ID');
const subject_id = jsPsych.randomization.randomID(10); // ID anonyme

/* ---------- AJOUT MÉTADONNÉES ---------- */
jsPsych.data.addProperties({
  subject_id: subject_id,
  prolific_id: prolific_id,
  study_id: study_id,
  session_id: session_id,
  first_block: first_block,
});

/* ---------- DÉFINITION DU NOM DE FICHIER ---------- */
const filename = `${subject_id}.csv`;

/* ---------- ÉCRANS PROLIFIC ET SAUVEGARDE ----------*/ 

const save_data = {
  type: jsPsychPipe,
  action: "save",
  experiment_id: "z3EXbmOc4TxL", // see DataPipe 
  filename: filename,
  data_string: () => jsPsych.data.get().csv()  
};

const prolific = {
  type: jsPsychHtmlKeyboardResponse,
  stimulus: `
    <p class='instructions'>
      Please wait a moment, you will automatically be redirected to Prolific.
    </p>`,
  trial_duration: 3000,
  choices: "NO_KEYS",
  on_finish: function(){
    window.location.href = "https://app.prolific.com/submissions/complete?cc=C13A97HN";
  }
};


const save_local = {
  type: jsPsychHtmlButtonResponse,
  stimulus: "<p>Click the button below to download your responses.</p>",
  choices: ["Download CSV"],
  on_finish: function() {
    const data_csv = jsPsych.data.get().csv();
    const blob = new Blob([data_csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "jspsych_data.csv";
    a.click();
    URL.revokeObjectURL(url);
  }
};

// ------------------------------
// TIMELINE
// ------------------------------
// Instructions for the first block (depends on counterbalanced order)
const first_block_instructions  = first_block  === "standard" ? standard_conditioning_instructions : reverse_conditioning_instructions;
const second_block_instructions = second_block === "standard" ? standard_conditioning_instructions : reverse_conditioning_instructions;

jsPsych.run([
  preload,
  welcome,
  consent,
  enter_fullscreen,
  videogameliketask,
  instructions_keys,
  instructions_osymbol,
  (condition === "approach_yellow" ? instructions_approachyellow : instructions_approachblue),

  // Block 1 (conditioning): explicit rule -> repeated VAAST exposure -> manipulation check
  first_block_instructions,
  makeStartVaastBlock(block1_items, 1, first_block),
  activateVaastBackground,
  activateVaastLayout,
  vaast_loop,
  deactivateVaastLayout,
  deactivateVaastBackground,
  makeInstructionCheck(first_block),

  between_blocks_screen,

  // Block 2 (conditioning): the other explicit rule, on the other 8 items
  second_block_instructions,
  makeStartVaastBlock(block2_items, 2, second_block),
  activateVaastBackground,
  activateVaastLayout,
  vaast_loop,
  deactivateVaastLayout,
  deactivateVaastBackground,
  makeInstructionCheck(second_block),

  // Single combined judgment phase (all 16 items)
  judgment_instructions,
  activateRatingStyle,
  judgment_trials,
  deactivateRatingStyle,

  ...attention_checks,
  bot_check_1,
  bot_check_2,
  comments,
  debriefing,
  save_data,
  prolific,
  //save_local,
]);