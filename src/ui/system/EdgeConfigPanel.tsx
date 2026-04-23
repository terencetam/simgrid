import type { CausalLink } from "@/engine/schema";
import { useScenarioStore } from "@/store/scenario-store";

interface EdgeConfigPanelProps {
  link: CausalLink;
  onClose: () => void;
}

export function EdgeConfigPanel({ link, onClose }: EdgeConfigPanelProps) {
  const updateCausalLink = useScenarioStore((s) => s.updateCausalLink);
  const removeCausalLink = useScenarioStore((s) => s.removeCausalLink);

  return (
    <div className="absolute right-4 top-4 w-64 bg-zinc-800 border border-zinc-600 rounded-lg p-4 shadow-xl z-10">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-semibold text-zinc-200">Edit Link</h3>
        <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 text-lg leading-none">&times;</button>
      </div>

      {/* Polarity */}
      <div className="mb-3">
        <label className="text-xs text-zinc-400 block mb-1">Polarity</label>
        <div className="flex gap-2">
          <button
            className={`flex-1 px-3 py-1.5 rounded text-xs font-medium ${
              link.polarity === "positive"
                ? "bg-green-900 text-green-300 border border-green-600"
                : "bg-zinc-700 text-zinc-400 border border-zinc-600"
            }`}
            onClick={() => updateCausalLink(link.id, { polarity: "positive" })}
          >
            + Reinforcing
          </button>
          <button
            className={`flex-1 px-3 py-1.5 rounded text-xs font-medium ${
              link.polarity === "negative"
                ? "bg-red-900 text-red-300 border border-red-600"
                : "bg-zinc-700 text-zinc-400 border border-zinc-600"
            }`}
            onClick={() => updateCausalLink(link.id, { polarity: "negative" })}
          >
            &minus; Balancing
          </button>
        </div>
      </div>

      {/* Strength */}
      <div className="mb-3">
        <div className="flex justify-between text-xs mb-1">
          <span className="text-zinc-400">Strength</span>
          <span className="font-mono text-zinc-300">{link.strength.toFixed(1)}</span>
        </div>
        <input
          type="range"
          min={0.1}
          max={2.0}
          step={0.1}
          value={link.strength}
          onChange={(e) => updateCausalLink(link.id, { strength: parseFloat(e.target.value) })}
          className="w-full h-1.5 bg-zinc-700 rounded-full appearance-none cursor-pointer
                     [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3
                     [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full
                     [&::-webkit-slider-thumb]:bg-indigo-500 [&::-webkit-slider-thumb]:cursor-pointer"
        />
      </div>

      {/* Delay */}
      <div className="mb-3">
        <div className="flex justify-between text-xs mb-1">
          <span className="text-zinc-400">Delay (periods)</span>
          <span className="font-mono text-zinc-300">{link.delay}</span>
        </div>
        <input
          type="range"
          min={0}
          max={12}
          step={1}
          value={link.delay}
          onChange={(e) => updateCausalLink(link.id, { delay: parseInt(e.target.value) })}
          className="w-full h-1.5 bg-zinc-700 rounded-full appearance-none cursor-pointer
                     [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3
                     [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full
                     [&::-webkit-slider-thumb]:bg-indigo-500 [&::-webkit-slider-thumb]:cursor-pointer"
        />
      </div>

      {/* Noise */}
      <div className="mb-4">
        <div className="flex justify-between text-xs mb-1">
          <span className="text-zinc-400">Noise (stddev)</span>
          <span className="font-mono text-zinc-300">{link.noise.toFixed(2)}</span>
        </div>
        <input
          type="range"
          min={0}
          max={0.5}
          step={0.01}
          value={link.noise}
          onChange={(e) => updateCausalLink(link.id, { noise: parseFloat(e.target.value) })}
          className="w-full h-1.5 bg-zinc-700 rounded-full appearance-none cursor-pointer
                     [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3
                     [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full
                     [&::-webkit-slider-thumb]:bg-indigo-500 [&::-webkit-slider-thumb]:cursor-pointer"
        />
      </div>

      {/* Description */}
      <div className="text-[10px] text-zinc-500 mb-3 leading-relaxed">
        When the source increases by 10%, the target will{" "}
        {link.polarity === "positive" ? "increase" : "decrease"} by{" "}
        {(link.strength * 10).toFixed(0)}%
        {link.delay > 0 && ` after ${link.delay} period${link.delay > 1 ? "s" : ""}`}.
      </div>

      {/* Delete */}
      <button
        onClick={() => {
          removeCausalLink(link.id);
          onClose();
        }}
        className="w-full px-3 py-1.5 text-xs font-medium text-red-400 bg-red-950 border border-red-800 rounded hover:bg-red-900 transition-colors"
      >
        Delete Link
      </button>
    </div>
  );
}
