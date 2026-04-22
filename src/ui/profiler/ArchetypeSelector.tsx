import { ARCHETYPE_CONFIGS, type Archetype } from "@/engine/profiler";

interface ArchetypeSelectorProps {
  onSelect: (archetype: Archetype) => void;
}

const ARCHETYPES = Object.values(ARCHETYPE_CONFIGS);

export function ArchetypeSelector({ onSelect }: ArchetypeSelectorProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {ARCHETYPES.map((config) => (
        <button
          key={config.id}
          onClick={() => onSelect(config.id)}
          className="flex flex-col items-center gap-2 p-6 bg-zinc-900 border border-zinc-800
                     rounded-xl hover:border-indigo-500 hover:bg-zinc-800/80
                     transition-all duration-200 hover:scale-[1.02] group"
        >
          <span className="text-3xl group-hover:scale-110 transition-transform">
            {config.icon}
          </span>
          <span className="text-sm font-semibold text-zinc-200">
            {config.name}
          </span>
          <span className="text-xs text-zinc-500 text-center">
            {config.description}
          </span>
        </button>
      ))}
    </div>
  );
}
