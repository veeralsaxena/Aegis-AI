
import React from 'react';

export default function Screen_clinical_queue_and_search_premium_453e344c012b455cbdfde6a16039956a() {
  return (
    <>
      <div className="flex h-screen overflow-hidden">
  <div className="w-64 flex-shrink-0 bg-black/40 backdrop-blur-2xl border-r border-white/5 flex flex-col h-full">
    <div className="p-6 flex items-center gap-3">
      <div className="bg-primary/20 p-2 rounded-xl text-primary flex items-center justify-center border border-primary/30 shadow-lg">
        <span className="material-symbols-outlined text-2xl">local_hospital</span>
      </div>
      <div className="flex flex-col">
        <h1 className="text-white text-lg font-bold leading-tight tracking-tight">Aegis AI</h1>
        <p className="text-slate-500 text-xs font-medium uppercase tracking-wider">Provider Dashboard</p>
      </div>
    </div>
    <nav className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-2">
      <a className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/5 text-slate-400 hover:text-white transition-all" href="#">
        <span className="material-symbols-outlined text-xl">home</span>
        <span className="text-sm font-medium">Home</span>
      </a>
      <a className="flex items-center gap-3 px-4 py-3 rounded-xl bg-primary/10 text-primary transition-all border border-primary/20 shadow-lg" href="#">
        <span className="material-symbols-outlined text-xl" style={{fontVariationSettings: '"FILL" 1'}}>search</span>
        <span className="text-sm font-medium">Search</span>
      </a>
      <a className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/5 text-slate-400 hover:text-white transition-all" href="#">
        <span className="material-symbols-outlined text-xl">queue</span>
        <span className="text-sm font-medium">Queue</span>
        <span className="ml-auto bg-primary text-white text-xs font-bold px-2 py-0.5 rounded-full shadow-lg">12</span>
      </a>
      <a className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/5 text-slate-400 hover:text-white transition-all" href="#">
        <span className="material-symbols-outlined text-xl">folder_shared</span>
        <span className="text-sm font-medium">Records</span>
      </a>
      <div className="my-4 border-t border-white/5" />
      <a className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/5 text-slate-400 hover:text-white transition-all" href="#">
        <span className="material-symbols-outlined text-xl">settings</span>
        <span className="text-sm font-medium">Settings</span>
      </a>
      <a className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/5 text-slate-400 hover:text-white transition-all" href="#">
        <span className="material-symbols-outlined text-xl">help</span>
        <span className="text-sm font-medium">Help</span>
      </a>
    </nav>
    <div className="p-4 mt-auto">
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl glass-card border-white/5">
        <div className="bg-center bg-no-repeat bg-cover rounded-full w-8 h-8 ring-2 ring-primary/20" data-alt="Provider Profile Avatar" style={{backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuA7N0R-P5TNs9neqNOa-tX0FlewvHm_tQPEeXT22pjQgSCoqAZaXP_g_t89Gz3H1aHNkO5D3xFdgr48z6H6vfdNaK25Ti3itrfYJpGbB25sB2huD-vnzlW1aKQDM80Y9hl-3-Y8y0bizcQcI4YTAq9963JdRKN3Yg0lKNBM1fm0ndx1hQoYH5OM4ASLCsgMjok6lx5KCP1lDPJmoELr-DOJWGFfIlelxFn-Mqs0HL9zTBInEc4iZt0IzELkQhHLDA30AJWHB3ssaMPX")'}} />
        <div className="flex flex-col overflow-hidden">
          <p className="text-white text-sm font-semibold truncate">Dr. Sarah Chen</p>
          <p className="text-slate-500 text-xs truncate">Cardiology Dept</p>
        </div>
      </div>
    </div>
  </div>
  <div className="flex-1 flex flex-col h-full overflow-hidden relative">
    <header className="px-8 py-8 flex-shrink-0 z-10">
      <div className="max-w-3xl mx-auto">
        <label className="flex flex-col w-full group">
          <div className="flex w-full items-center rounded-2xl glass-card border-primary/30 shadow-lg group-focus-within:shadow-lg group-focus-within:border-primary transition-all duration-300 h-14 overflow-hidden">
            <div className="text-primary flex items-center justify-center pl-5">
              <span className="material-symbols-outlined text-2xl">search</span>
            </div>
            <input className="w-full bg-transparent border-none text-white focus:ring-0 placeholder:text-slate-600 px-4 text-lg font-medium outline-none" placeholder="Search patients by name, MRN, or condition..." />
            <div className="pr-5 flex gap-2">
              <button className="bg-white/5 hover:bg-white/10 text-primary rounded-lg px-3 py-1 text-sm font-semibold transition-colors flex items-center gap-1 border border-white/5">
                <span className="material-symbols-outlined text-sm">tune</span> Filter
              </button>
            </div>
          </div>
        </label>
        <div className="flex gap-2 mt-3 px-2 text-sm text-slate-500">
          <span>Recent:</span>
          <a className="hover:text-primary transition-colors" href="#">#MRN-8492</a>,
          <a className="hover:text-primary transition-colors" href="#">Emma Watson</a>,
          <a className="hover:text-primary transition-colors" href="#">Cardiac Consults</a>
        </div>
      </div>
    </header>
    <main className="flex-1 overflow-y-auto px-8 pb-8 z-10">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <span className="material-symbols-outlined text-primary" style={{fontVariationSettings: '"FILL" 1'}}>notifications_active</span>
            Active Queue
            <span className="bg-primary/10 text-primary text-sm px-2.5 py-0.5 rounded-full font-semibold ml-2 border border-primary/20 shadow-lg">4 Waiting</span>
          </h2>
          <button className="text-sm font-medium text-primary hover:text-primary/80 transition-colors flex items-center gap-1">
            View All <span className="material-symbols-outlined text-sm">arrow_forward</span>
          </button>
        </div>
        <div className="flex overflow-x-auto gap-6 pb-4 -mx-2 px-2 snap-x">
          <div className="snap-start flex-shrink-0 w-80 rounded-2xl glass-card p-5 flex flex-col gap-4 shadow-xl hover:border-primary/50 transition-all duration-300 cursor-pointer relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-1.5 h-full bg-red-500/80 shadow-lg" />
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <img alt="Patient Avatar" className="w-12 h-12 rounded-full object-cover border-2 border-white/10" data-alt="Patient Profile Picture" src="https://lh3.googleusercontent.com/aida-public/AB6AXuA3tqUXzXiCSqqfzHbRhFhN-J8EvRy2RBYjRnz-4Kg56tjuTqnFCpRIeD3D63LgNIRAgR_toDXc9R5kFIo2r3a1XiW_dOnbp7Z3Ycyw9G2St3W9k_4pLK0I5eEo6_S7V5Gbsy3LSjwtiwyKM3X_sZI9l3INuyU4oPUMWhaU63MspEjVZcLnmxclI-d1jOHICOKoDojE9HaHtzd_uEIr9HFJ7rMkx7enq42fTqC6f8bKok65VImaHpO9OTYEhM5PToUURZxlAGMZgJeh" />
                  <div className="absolute -bottom-1 -right-1 bg-red-500 w-4 h-4 rounded-full border-2 border-midnight shadow-lg" />
                </div>
                <div>
                  <h3 className="text-white font-bold text-lg leading-tight">Robert Jenkins</h3>
                  <p className="text-slate-500 text-sm">MRN: 482910</p>
                </div>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-red-400 font-bold text-lg">24m</span>
                <span className="text-slate-500 text-[10px] uppercase tracking-widest">Waiting</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm mt-2">
              <div className="bg-white/5 rounded-lg p-2 flex flex-col border border-white/5">
                <span className="text-slate-500 text-xs">Age / Sex</span>
                <span className="text-slate-200 font-medium">68 • M</span>
              </div>
              <div className="bg-white/5 rounded-lg p-2 flex flex-col border border-white/5">
                <span className="text-slate-500 text-xs">Reason</span>
                <span className="text-slate-200 font-medium truncate">Chest Pain</span>
              </div>
            </div>
            <div className="mt-2 flex gap-2">
              <button className="flex-1 liquid-button text-midnight py-2.5 rounded-xl font-bold text-sm">Begin Visit</button>
            </div>
          </div>
          <div className="snap-start flex-shrink-0 w-80 rounded-2xl glass-card p-5 flex flex-col gap-4 shadow-xl hover:border-primary/50 transition-all duration-300 cursor-pointer relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-1.5 h-full bg-amber-500/80 shadow-lg" />
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <img alt="Patient Avatar" className="w-12 h-12 rounded-full object-cover border-2 border-white/10" data-alt="Patient Profile Picture" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBLazbs9G65pNWpA0RFez76wK3ibLz8d7oz5LP4pejd0RuRH9LOSDHdLQmyx_wDq-jZ3Z77WRcJqWeR6c_i0MHmiUNttEOi00j-OiMVf91ucSQxWwwJz56GNSTRMHAgA1clhJM-gEXGaVOsgV3HlzmuLUL4s-49dro85zhGefVQ79JOAgSOzcJpF6_P7goecGpU8oLiIqjTwYSMgK8rHGtlWZCnkYZWKo_Avy_CrjXTCtW1jKaca-dynya93kiOYpPz_lwD6XPKiaHr" />
                  <div className="absolute -bottom-1 -right-1 bg-amber-500 w-4 h-4 rounded-full border-2 border-midnight shadow-lg" />
                </div>
                <div>
                  <h3 className="text-white font-bold text-lg leading-tight">Elena Martinez</h3>
                  <p className="text-slate-500 text-sm">MRN: 392011</p>
                </div>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-amber-400 font-bold text-lg">18m</span>
                <span className="text-slate-500 text-[10px] uppercase tracking-widest">Waiting</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm mt-2">
              <div className="bg-white/5 rounded-lg p-2 flex flex-col border border-white/5">
                <span className="text-slate-500 text-xs">Age / Sex</span>
                <span className="text-slate-200 font-medium">42 • F</span>
              </div>
              <div className="bg-white/5 rounded-lg p-2 flex flex-col border border-white/5">
                <span className="text-slate-500 text-xs">Reason</span>
                <span className="text-slate-200 font-medium truncate">Follow-up ECG</span>
              </div>
            </div>
            <div className="mt-2 flex gap-2">
              <button className="flex-1 bg-white/5 text-white py-2.5 rounded-xl font-bold text-sm hover:bg-white/10 transition-colors border border-white/10">View Chart</button>
            </div>
          </div>
          <div className="snap-start flex-shrink-0 w-80 rounded-2xl glass-card p-5 flex flex-col gap-4 shadow-xl hover:border-primary/50 transition-all duration-300 cursor-pointer relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-1.5 h-full bg-green-500/80 shadow-lg" />
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <img alt="Patient Avatar" className="w-12 h-12 rounded-full object-cover border-2 border-white/10" data-alt="Patient Profile Picture" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAIxs0I5JGAbLqLTa2bEWOOPsmm7Lrz-P_WPNaaVaTSPnqUowVLy-ZhxNdXptxJATokALPps51xhipez3fQ0W4jBUrD050-o0PZTnE_LRhOYsNetWmjzg2i3pgFGRql_qzOL1KXLj-0M07qK6fFpCo28LOIotKv_FvTH6gtgWORJ_EDmT_KpJnrmWWPmJmFVRDqv7av1OAKD4VjvRAYVzfcHiLem9DDmY44SoHNvKSqtrdB6Sq3FDDgCYj7X0AEA2UeS9cVO9lMJ3G0" />
                  <div className="absolute -bottom-1 -right-1 bg-green-500 w-4 h-4 rounded-full border-2 border-midnight shadow-lg" />
                </div>
                <div>
                  <h3 className="text-white font-bold text-lg leading-tight">Marcus Johnson</h3>
                  <p className="text-slate-500 text-sm">MRN: 102934</p>
                </div>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-green-400 font-bold text-lg">5m</span>
                <span className="text-slate-500 text-[10px] uppercase tracking-widest">Waiting</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm mt-2">
              <div className="bg-white/5 rounded-lg p-2 flex flex-col border border-white/5">
                <span className="text-slate-500 text-xs">Age / Sex</span>
                <span className="text-slate-200 font-medium">28 • M</span>
              </div>
              <div className="bg-white/5 rounded-lg p-2 flex flex-col border border-white/5">
                <span className="text-slate-500 text-xs">Reason</span>
                <span className="text-slate-200 font-medium truncate">Routine Check</span>
              </div>
            </div>
            <div className="mt-2 flex gap-2">
              <button className="flex-1 bg-white/5 text-white py-2.5 rounded-xl font-bold text-sm hover:bg-white/10 transition-colors border border-white/10">View Chart</button>
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>
</div>

    </>
  );
}
