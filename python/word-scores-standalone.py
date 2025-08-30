
""""
This code takes hand-edited changes to the category-words.json and makes the stats
required for the score updates. It writes those files back into the static/site-data folder.  You need pandas to run it.
"""

import json
import pandas as pd
import re
import math
from collections import defaultdict

CATEGORIES_FILE = "category-words.json"
TEXTS_FILE = "small_merged_data_embeds_metadata.json"
PATH = "../static/site-data/"


def search_text_with_word_boundaries(text_line: str, search_string: str) -> bool:
    """
    Searches a line of text (case-insensitively, with word boundaries) for a given string.
    The generated regex pattern is compatible with JavaScript.

    Args:
        text_line: The text to search within.
        search_string: The string to search for.

    Returns:
        True if the search string is found as a whole word, False otherwise.
    """
    if not search_string:
        # An empty search string doesn't make sense with word boundaries
        return False

    # 1. Convert the text line to lowercase as specified
    text_line_lower = text_line.lower()

    # 2. Escape the search string to handle any special regex characters
    #    This makes the search string literal within the regex.
    #    Also lowercase the search string itself for consistent matching.
    escaped_search_string = re.escape(search_string.lower())

    # 3. Construct the regex pattern with word boundaries
    #    '\b' matches a word boundary. This is standard in both Python and JavaScript regex.
    #    The resulting `regex_pattern` string can be directly used in JavaScript.
    regex_pattern = r'\b' + escaped_search_string + r'\b'

    # 4. Perform the search using re.search
    #    re.search returns a match object if found, None otherwise.
    #    We don't need re.IGNORECASE because we pre-lowercased both the text and search string.
    match = re.search(regex_pattern, text_line_lower)

    # 5. Return True if a match is found, False otherwise
    return match is not None


def get_counts_per_string(texts, categories):
    # Create counting dictionaries - automatically removes duplicates from category lists
    new_cats = {key: {val: 0 for val in vals} for key, vals in categories.items()}

    for key, vals in categories.items():
        for text in texts:
            for val in vals:
                if search_text_with_word_boundaries(text, val):
                    new_cats[key][val] += 1
    return new_cats


def calculate_category_weighted_scores(tallies):
    """
    Calculate scoring metrics that weight by both term rarity and category rarity.
    Terms in rarer categories and with fewer individual matches get higher scores.

    Args:
        tallies: Dictionary with categories containing word counts

    Returns:
        Dictionary with scoring results and analysis
    """
    category_totals = {}
    all_terms = {}

    for category, terms in tallies.items():
        category_total = sum(count for count in terms.values() if count > 1)
        if category_total > 0:
            category_totals[category] = category_total
            for term, count in terms.items():
                if count > 0:
                    all_terms[f"{category}::{term}"] = {
                        'category': category,
                        'term': term,
                        'count': count,
                        'category_total': category_total
                    }

    if not all_terms:
        return {"error": "No terms found with more than 1 match"}

    max_category_total = max(category_totals.values()) if category_totals else 1
    category_weights = {
        category: max_category_total / total
        for category, total in category_totals.items()
    }

    weighted_inverse_scores = {}
    for term_key, term_data in all_terms.items():
        category = term_data['category']
        count = term_data['count']
        category_weight = category_weights.get(category, 1)
        score = (1.0 / count) * category_weight
        weighted_inverse_scores[term_key] = score

    # --- MODIFIED SCORING LOGIC ---
    # Method 2: Normalized weighted scores (scaled 1-100)
    normalized_weighted_scores = {}
    if weighted_inverse_scores:
        scores = weighted_inverse_scores.values()
        min_score = min(scores)
        max_score = max(scores)

        if max_score == min_score:
            # If all scores are the same, assign them all 100
            normalized_weighted_scores = {term: 100.0 for term in weighted_inverse_scores}
        else:
            # Scale scores to the range [1, 100]
            score_range = max_score - min_score
            for term, score in weighted_inverse_scores.items():
                # Formula: new_min + (value - old_min) * (new_range / old_range)
                normalized_score = 1 + ((score - min_score) * 99 / score_range)
                normalized_weighted_scores[term] = normalized_score

    log_weighted_scores = {}
    for term_key, term_data in all_terms.items():
        category = term_data['category']
        count = term_data['count']
        category_weight = category_weights.get(category, 1)
        individual_score = 1.0 / math.log(count + 1)
        score = individual_score * category_weight
        log_weighted_scores[term_key] = score

    results = {}
    for method_name, scores in [
        ("weighted_inverse", weighted_inverse_scores),
        ("normalized_weighted", normalized_weighted_scores),
        ("log_weighted", log_weighted_scores)
    ]:
        sorted_scores = sorted(scores.items(), key=lambda x: x[1], reverse=True)
        results[method_name] = {
            "scores": dict(sorted_scores),
            "top_15": sorted_scores[:15],
            "all": sorted_scores
        }

    top_terms_detail = []
    for term_key, score in results["normalized_weighted"]["top_15"]:
        term_data = all_terms[term_key]
        top_terms_detail.append({
            "term": term_data['term'],
            "category": term_data['category'],
            "term_count": term_data['count'],
            "category_total": term_data['category_total'],
            "category_weight": category_weights.get(term_data['category'], 1),
            "final_score": score
        })

    results["summary"] = {
        "total_terms_analyzed": len(all_terms),
        "categories_analyzed": len(category_totals),
        "category_totals": category_totals,
        "category_weights": category_weights,
        "top_terms_breakdown": top_terms_detail
    }

    return results


def organize_scores_by_category(category_weighted_results, tallies, scoring_method="normalized_weighted"):
    """
    Organize the scoring results by category with objects containing string, count, and score.

    Args:
        category_weighted_results: Results from calculate_category_weighted_scores
        tallies: Original tallies dictionary to get counts
        scoring_method: Which scoring method to use ("normalized_weighted", "weighted_inverse", "log_weighted")

    Returns:
        Dictionary organized by category with term objects
    """
    if "error" in category_weighted_results:
        return {"error": category_weighted_results["error"]}

    # Get the "all" results from the specified scoring method
    if scoring_method not in category_weighted_results:
        return {"error": f"Scoring method '{scoring_method}' not found"}

    all_results = category_weighted_results[scoring_method]['scores']

    # Initialize the output dictionary
    output_by_category = {}

    # Process each scored term
    for term_key, score in all_results.items():
        # Parse the term key (format: "category::term")
        if "::" not in term_key:
            continue

        category, term = term_key.split("::", 1)

        # Get the original count from tallies
        original_count = tallies.get(category, {}).get(term, 0)

        # Initialize category if not exists
        if category not in output_by_category:
            output_by_category[category] = []

        # Add the term object to the category
        term_object = {
            "string": term,
            "count": original_count,
            "score": round(score)  # Round to integer as requested
        }

        output_by_category[category].append(term_object)

    # Sort each category's terms by score (highest first)
    for category in output_by_category:
        output_by_category[category].sort(key=lambda x: x["score"], reverse=True)

    return output_by_category


def make_score_lookup(organized_scores):
    lookup = {}
    for key, vals in organized_scores.items():
        for val in vals:
            lookup[val['string']] = val['score']
    return lookup


## Key function to turn the human editable category list into scores for use. Run before building
def make_score_file(categories_file, texts_file, path="./"):
    cats = json.load(open(path + categories_file, "r"))
    print(cats.keys())
    df = pd.read_json(path + texts_file, orient="records")
    print(len(df))
    tallies = get_counts_per_string(df['text'].values, cats)
    category_weighted_results = calculate_category_weighted_scores(tallies)
    organized_scores = organize_scores_by_category(category_weighted_results, tallies, scoring_method="normalized_weighted")
    json.dump(organized_scores, open(path + "scores_detail.json", "w"))
    score_lookup = make_score_lookup(organized_scores)
    print("score for hyaenas:", score_lookup['hyaenas'])
    json.dump(score_lookup, open(path + "scores_lookup.json", "w"))
    print("Done making score files")

def test_score_files(categories_file=CATEGORIES_FILE, texts_file=TEXTS_FILE, path=PATH):
    cats = json.load(open(path + categories_file, "r"))
    print("categories:", cats.keys())
    print("animals members:", cats['animals'])
    df = pd.read_json(path + texts_file, orient="records")
    print("number of records:", len(df))
    tallies = get_counts_per_string(df['text'].values, cats)
    print(tallies['animals'])
    category_weighted_results = calculate_category_weighted_scores(tallies)
    organized_scores = organize_scores_by_category(category_weighted_results, tallies, scoring_method="normalized_weighted")
    test = organized_scores['animals']
    test.sort(key=lambda x: x['count'])
    print("animals members sorted by count:", test)

if __name__ == "__main__":
    # Example usage
    categories_file = CATEGORIES_FILE
    texts_file = TEXTS_FILE
    path = PATH

    make_score_file(categories_file, texts_file, path=path)
