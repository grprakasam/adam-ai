"""
Performance Test with Actual Specification File
Tests code generation with real specification data and shows detailed metrics per variable
"""

import asyncio
import time
import sys
from pathlib import Path
from typing import List, Dict, Any
from datetime import datetime

# Add backend to path
backend_path = Path(__file__).parent.parent
sys.path.insert(0, str(backend_path))

from app.modules.code_generator.service import get_code_generator_service
from app.modules.variable_categorizer.parser import SpecificationParser
from loguru import logger

# Configure logger
logger.remove()
logger.add(sys.stderr, level="INFO")


def load_specification(file_path: Path) -> List[Dict[str, Any]]:
    """Load specification Excel file using the app's parser"""
    try:
        parser = SpecificationParser(str(file_path))
        parser.load_specification()
        variables = parser.get_variables()  # Use get_variables() instead of extract_variables()
        print(f"✅ Loaded specification: {len(variables)} variables")
        return variables
    except Exception as e:
        print(f"❌ Error loading specification: {e}")
        import traceback
        traceback.print_exc()
        raise


def prepare_variables_from_spec(variables: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Convert specification variables to categorized variables format"""
    formatted_variables = []
    
    for var in variables:
        var_name = var.get('name', '').strip()
        if not var_name:
            continue
        
        # Map parser output to expected format
        formatted_variables.append({
            'name': var_name,
            'type': var.get('type', 'Char'),
            'label': var.get('label', var_name),
            'derivation': var.get('derivation', f'Derive {var_name}'),
            'is_required': var.get('is_required', False)
        })
    
    return {
        'categories': [
            {
                'name': 'All Variables',
                'variables': formatted_variables
            }
        ],
        'total_variables': len(formatted_variables)
    }


async def generate_with_detailed_metrics(
    service,
    categorized_variables: Dict[str, Any],
    language: str = "R"
) -> Dict[str, Any]:
    """Generate code with detailed per-variable timing"""
    
    all_variables = service.collect_all_variables(categorized_variables)
    total_vars = len(all_variables)
    
    print(f"\n{'='*80}")
    print(f"GENERATING CODE FOR {total_vars} VARIABLES")
    print(f"{'='*80}\n")
    
    # Build context
    context = service.build_generation_context(
        study_id="SPEC_TEST_001",
        dataset="ADSL",
        standards={
            "sdtm_version": "1.7",
            "adam_ig_version": "1.3",
            "meddra_version": "26.0"
        },
        categorized_variables=categorized_variables
    )
    
    # Track metrics per variable
    variable_metrics = []
    results = []
    
    overall_start = time.time()
    
    # Process with progress tracking
    async def progress_callback(progress_data):
        status = progress_data.get('status', '')
        if status == 'variable_completed':
            var_name = progress_data.get('variable_name', 'Unknown')
            completed = progress_data.get('completed', 0)
            print(f"  [{completed:3d}/{total_vars}] ✅ {var_name}")
    
    # Generate code
    print("🚀 Starting code generation...\n")
    generation_start = time.time()
    
    results = await service.process_variables_with_llm(
        variables=all_variables,
        language=language,
        context=context,
        llm_provider="groq",
        progress_callback=progress_callback
    )
    
    generation_end = time.time()
    overall_end = time.time()
    
    # Analyze results
    template_count = 0
    llm_count = 0
    cached_count = 0
    error_count = 0
    
    for result in results:
        metadata = result.get('metadata', {})
        method = metadata.get('generation_method', 'llm')
        provider = metadata.get('provider', 'unknown')
        
        if method == 'template_based':
            template_count += 1
        elif provider == 'cache':
            cached_count += 1
        elif result.get('error'):
            error_count += 1
        else:
            llm_count += 1
    
    total_time = overall_end - overall_start
    generation_time = generation_end - generation_start
    
    return {
        'results': results,
        'total_variables': total_vars,
        'total_time': total_time,
        'generation_time': generation_time,
        'template_count': template_count,
        'llm_count': llm_count,
        'cached_count': cached_count,
        'error_count': error_count,
        'variables_per_second': total_vars / total_time if total_time > 0 else 0
    }


def print_detailed_metrics(metrics: Dict[str, Any]):
    """Print detailed metrics"""
    results = metrics['results']
    total_vars = metrics['total_variables']
    total_time = metrics['total_time']
    generation_time = metrics['generation_time']
    
    print(f"\n{'='*80}")
    print("DETAILED PERFORMANCE METRICS")
    print(f"{'='*80}\n")
    
    # Overall summary
    print("📊 OVERALL SUMMARY")
    print("-" * 80)
    print(f"Total Variables:        {total_vars}")
    print(f"Total Time:              {total_time:.2f} seconds ({total_time/60:.2f} minutes)")
    print(f"Generation Time:         {generation_time:.2f} seconds")
    print(f"Variables/Second:        {metrics['variables_per_second']:.2f}")
    print(f"Average Time/Variable:   {total_time/total_vars:.2f} seconds")
    print()
    
    # Breakdown by generation method
    print("📈 GENERATION METHOD BREAKDOWN")
    print("-" * 80)
    print(f"Template-Based:          {metrics['template_count']:3d} ({metrics['template_count']/total_vars*100:5.1f}%)")
    print(f"LLM-Generated:          {metrics['llm_count']:3d} ({metrics['llm_count']/total_vars*100:5.1f}%)")
    print(f"Cached:                  {metrics['cached_count']:3d} ({metrics['cached_count']/total_vars*100:5.1f}%)")
    print(f"Errors:                  {metrics['error_count']:3d} ({metrics['error_count']/total_vars*100:5.1f}%)")
    print()
    
    # Per-variable details
    print("📋 PER-VARIABLE DETAILS")
    print("-" * 80)
    print(f"{'#':<4} {'Variable':<20} {'Method':<15} {'Status':<10} {'Code Length':<12}")
    print("-" * 80)
    
    for i, result in enumerate(results, 1):
        var_name = result.get('variable', 'Unknown')
        metadata = result.get('metadata', {})
        method = metadata.get('generation_method', 'llm')
        provider = metadata.get('provider', 'unknown')
        
        if method == 'template_based':
            method_display = 'Template'
        elif provider == 'cache':
            method_display = 'Cached'
        else:
            method_display = f"LLM ({provider})"
        
        status = '✅ OK' if not result.get('error') else '❌ Error'
        code_snippet = result.get('code_snippet', '')
        code_length = len(code_snippet)
        
        print(f"{i:<4} {var_name:<20} {method_display:<15} {status:<10} {code_length:<12}")
    
    print("-" * 80)
    print()
    
    # Performance analysis
    print("⚡ PERFORMANCE ANALYSIS")
    print("-" * 80)
    
    if total_vars <= 50:
        target_time = 60
        status = "✅ EXCELLENT" if total_time <= target_time else "⚠️  ACCEPTABLE"
        print(f"Target for {total_vars} variables: <{target_time}s")
        print(f"Actual time: {total_time:.1f}s")
        print(f"Status: {status}")
    elif total_vars <= 100:
        target_time = 120
        status = "✅ EXCELLENT" if total_time <= target_time else "⚠️  ACCEPTABLE"
        print(f"Target for {total_vars} variables: <{target_time}s")
        print(f"Actual time: {total_time:.1f}s")
        print(f"Status: {status}")
    else:
        target_time = total_vars * 1.2  # 1.2 seconds per variable
        status = "✅ EXCELLENT" if total_time <= target_time else "⚠️  ACCEPTABLE"
        print(f"Target for {total_vars} variables: <{target_time:.0f}s")
        print(f"Actual time: {total_time:.1f}s")
        print(f"Status: {status}")
    
    print()


async def main():
    """Main test function"""
    print("\n" + "="*80)
    print("SPECIFICATION-BASED CODE GENERATION PERFORMANCE TEST")
    print("="*80)
    
    # Find specification file
    spec_dir = Path(__file__).parent.parent.parent / "Content" / "UserInputs" / "ADAMSpecifications"
    
    # Try different spec files
    spec_files = [
        spec_dir / "ADSLSpec.xlsx",
        spec_dir / "ADSL_Specification_test.xlsx",
        spec_dir / "R spec.xlsx"
    ]
    
    spec_file = None
    for file in spec_files:
        if file.exists():
            spec_file = file
            break
    
    if not spec_file:
        print(f"❌ No specification file found in {spec_dir}")
        print("Available files:")
        for file in spec_dir.glob("*.xlsx"):
            print(f"  - {file.name}")
        return
    
    print(f"\n📄 Using specification: {spec_file.name}")
    
    # Load specification
    try:
        variables = load_specification(spec_file)
        print(f"   Variables found: {len(variables)}")
    except Exception as e:
        print(f"❌ Failed to load specification: {e}")
        return
    
    # Prepare variables
    categorized_variables = prepare_variables_from_spec(variables)
    total_vars = categorized_variables['total_variables']
    
    print(f"\n📊 Specification Summary:")
    print(f"   Total variables: {total_vars}")
    print(f"   Language: R")
    print(f"   Dataset: ADSL")
    
    # Get service
    service = get_code_generator_service()
    print(f"\n⚙️  Service Configuration:")
    print(f"   Batch size: {service.batch_size}")
    print(f"   Max concurrent: {service.max_concurrent}")
    
    # Generate code with metrics
    try:
        metrics = await generate_with_detailed_metrics(
            service,
            categorized_variables,
            language="R"
        )
        
        # Print detailed metrics
        print_detailed_metrics(metrics)
        
        # Save results to file
        output_file = Path(__file__).parent.parent / "performance_results.json"
        import json
        with open(output_file, 'w') as f:
            json.dump({
                'timestamp': datetime.now().isoformat(),
                'spec_file': spec_file.name,
                'total_variables': metrics['total_variables'],
                'total_time': metrics['total_time'],
                'generation_time': metrics['generation_time'],
                'template_count': metrics['template_count'],
                'llm_count': metrics['llm_count'],
                'cached_count': metrics['cached_count'],
                'error_count': metrics['error_count'],
                'variables_per_second': metrics['variables_per_second'],
                'results': [
                    {
                        'variable': r.get('variable'),
                        'method': r.get('metadata', {}).get('generation_method', 'llm'),
                        'provider': r.get('metadata', {}).get('provider', 'unknown'),
                        'has_error': bool(r.get('error')),
                        'code_length': len(r.get('code_snippet', ''))
                    }
                    for r in metrics['results']
                ]
            }, f, indent=2)
        
        print(f"💾 Results saved to: {output_file}")
        
    except Exception as e:
        print(f"❌ Error during generation: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(main())
