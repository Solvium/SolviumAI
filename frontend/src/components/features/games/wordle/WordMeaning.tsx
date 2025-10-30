/**
 * Word Meaning Component for Solvium Wordle
 *
 * Displays word definitions, synonyms, and other information after successful guesses.
 */

import React, { useState, useEffect } from "react";
import {
  BookOpen,
  X,
  ChevronDown,
  ChevronUp,
  Lightbulb,
  Users,
  Tag,
} from "lucide-react";
import { getWordInfo, WordInfo } from "@/lib/wordle/geminiWordFetcher";

interface WordMeaningProps {
  word: string;
  isOpen: boolean;
  onClose: () => void;
}

export const WordMeaning: React.FC<WordMeaningProps> = ({
  word,
  isOpen,
  onClose,
}) => {
  const [wordInfo, setWordInfo] = useState<WordInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(["meanings"])
  );

  useEffect(() => {
    if (isOpen && word) {
      fetchWordInfo();
    }
  }, [isOpen, word]);

  const fetchWordInfo = async () => {
    setLoading(true);
    try {
      const info = await getWordInfo(word);
      setWordInfo(info);
    } catch (error) {
      console.error("Failed to fetch word info:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl max-w-2xl w-full max-h-[80vh] overflow-hidden border border-white/20">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/20">
          <div className="flex items-center gap-3">
            <BookOpen className="w-6 h-6 text-[#1EC7FF]" />
            <h2 className="text-2xl font-bold text-white">
              {word.toUpperCase()}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(80vh-120px)]">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1EC7FF]"></div>
              <span className="ml-3 text-gray-300">
                Loading word information...
              </span>
            </div>
          ) : wordInfo ? (
            <div className="space-y-6">
              {/* Meanings Section */}
              <div className="bg-white/5 rounded-lg p-4">
                <button
                  onClick={() => toggleSection("meanings")}
                  className="flex items-center justify-between w-full text-left"
                >
                  <div className="flex items-center gap-2">
                    <Lightbulb className="w-5 h-5 text-yellow-400" />
                    <h3 className="text-lg font-semibold text-white">
                      Definitions
                    </h3>
                  </div>
                  {expandedSections.has("meanings") ? (
                    <ChevronUp className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  )}
                </button>

                {expandedSections.has("meanings") && (
                  <div className="mt-4 space-y-3">
                    {wordInfo.meanings.map((meaning, index) => (
                      <div key={index} className="bg-white/5 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <Tag className="w-4 h-4 text-[#1EC7FF]" />
                          <span className="text-sm font-medium text-[#1EC7FF] uppercase">
                            {meaning.partOfSpeech}
                          </span>
                        </div>
                        <p className="text-gray-200 mb-2">
                          {meaning.definition}
                        </p>
                        {meaning.examples.length > 0 && (
                          <div className="text-sm text-gray-400">
                            <span className="font-medium">Examples: </span>
                            {meaning.examples.slice(0, 3).join(", ")}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Synonyms Section */}
              {wordInfo.synonyms.length > 0 && (
                <div className="bg-white/5 rounded-lg p-4">
                  <button
                    onClick={() => toggleSection("synonyms")}
                    className="flex items-center justify-between w-full text-left"
                  >
                    <div className="flex items-center gap-2">
                      <Users className="w-5 h-5 text-green-400" />
                      <h3 className="text-lg font-semibold text-white">
                        Synonyms
                      </h3>
                    </div>
                    {expandedSections.has("synonyms") ? (
                      <ChevronUp className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    )}
                  </button>

                  {expandedSections.has("synonyms") && (
                    <div className="mt-4">
                      <div className="flex flex-wrap gap-2">
                        {wordInfo.synonyms
                          .slice(0, 10)
                          .map((synonym, index) => (
                            <span
                              key={index}
                              className="px-3 py-1 bg-green-500/20 text-green-300 rounded-full text-sm border border-green-500/30"
                            >
                              {synonym}
                            </span>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Word Stats */}
              <div className="bg-white/5 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                  <Tag className="w-5 h-5 text-purple-400" />
                  Word Information
                </h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-400">Length:</span>
                    <span className="ml-2 text-white font-medium">
                      {word.length} letters
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400">Difficulty:</span>
                    <span className="ml-2 text-white font-medium">
                      {word.length <= 4
                        ? "Easy"
                        : word.length <= 6
                        ? "Medium"
                        : "Hard"}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400">Meanings:</span>
                    <span className="ml-2 text-white font-medium">
                      {wordInfo.meanings.length}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400">Synonyms:</span>
                    <span className="ml-2 text-white font-medium">
                      {wordInfo.synonyms.length}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-400">
                No information available for this word.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-white/20">
          <button
            onClick={onClose}
            className="w-full bg-[#1EC7FF] hover:bg-[#1EC7FF]/80 text-white font-semibold py-3 rounded-xl transition-all duration-200"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
