# AI Agent Self-Improvement Guide

**Purpose**: Guidelines for AI agents to continuously improve the instruction files in `.ai/` based on emerging code patterns, best practices, and lessons learned.

## Improvement Triggers

AI agents should suggest updates to instruction files when they observe:

- **New Patterns**: Code patterns not covered by existing instructions
- **Repeated Implementations**: Similar code structures appearing across multiple files (3+)
- **Common Errors**: Recurring bugs or issues that could be prevented by better guidelines
- **New Technologies**: Libraries, tools, or frameworks being used consistently
- **Emerging Practices**: Better ways of doing things discovered during development
- **Missing Context**: Situations where current instructions lack necessary detail
- **Outdated Information**: Instructions that no longer match current implementation

## Analysis Process

When working on code, AI agents should:

1. **Compare Current Work with Instructions**
   - Does the current task follow existing guidelines?
   - Are there gaps in the instructions?
   - Are the examples still relevant?

2. **Identify Standardization Opportunities**
   - Look for patterns that should be documented
   - Find common approaches that aren't standardized
   - Note inconsistencies in implementation

3. **Review External Resources**
   - Check if new documentation is available
   - Verify that referenced links are still valid
   - Look for updated best practices from libraries/frameworks

4. **Monitor Error Patterns**
   - Track bugs and their root causes
   - Identify preventable issues
   - Document error handling strategies

5. **Assess Test Coverage**
   - Review testing patterns
   - Note effective testing strategies
   - Identify testing gaps

## When to Update Instructions

### Add New Guidance When:

- A new technology/pattern is used in **3+ files**
- Common bugs could be **prevented by documentation**
- The same feedback appears in **multiple contexts**
- New **security or performance** patterns emerge
- A **complex pattern** is successfully implemented
- **Configuration or setup** steps are discovered

### Modify Existing Guidance When:

- **Better examples** exist in the actual codebase
- **Additional edge cases** are discovered
- **Related instructions** have been updated
- **Implementation details** have changed
- **External documentation** has been updated
- **Technology versions** have changed

### Example: Pattern Recognition

```python
# If you see repeated patterns like:
async def fetch_user_data(user_id: str) -> Dict[str, Any]:
    """Fetch user data with error handling."""
    try:
        response = await http_client.get(f"/users/{user_id}")
        response.raise_for_status()
        return response.json()
    except HTTPException as e:
        logger.error(f"Failed to fetch user {user_id}: {e}")
        raise

# Consider adding to coding-standards.md:
# - Standard error handling patterns
# - Logging conventions
# - Async function patterns
# - Type hint usage
```

### Example: Testing Pattern Recognition

```python
# If you see repeated test patterns like:
@pytest.fixture
def mock_database():
    """Mock database connection for testing."""
    db = MagicMock()
    db.query.return_value = [{"id": 1, "name": "test"}]
    return db

def test_user_service(mock_database):
    service = UserService(mock_database)
    result = service.get_users()
    assert len(result) == 1

# Consider adding to testing.md:
# - Standard fixture patterns
# - Mocking strategies
# - Test naming conventions
# - Assertion patterns
```

## Instruction Quality Checks

When updating instruction files, ensure:

- **Actionable**: Guidelines should be clear and implementable
- **Specific**: Avoid vague advice, provide concrete examples
- **Current**: Examples should reflect actual code in the project
- **Referenced**: Link to relevant documentation and files
- **Consistent**: Align with other instruction files
- **Complete**: Cover edge cases and exceptions

## Continuous Improvement Workflow

### During Development:

1. **Note Gaps**: When instructions are unclear or missing, document what's needed
2. **Collect Examples**: Save good code examples that could be added to instructions
3. **Track Issues**: Record problems that better instructions could prevent
4. **Monitor Questions**: If you need clarification, others might too

### After Completing Tasks:

1. **Review Instructions**: Did they help? What was missing?
2. **Propose Updates**: Suggest specific improvements with examples
3. **Update Documentation**: If you found a better way, document it
4. **Cross-Reference**: Link related instructions together

### Periodic Reviews:

- **Monthly**: Review all instruction files for outdated content
- **After Major Features**: Update affected instruction files
- **After Refactors**: Ensure instructions match new structure
- **After Dependencies Update**: Update technology-specific guidance

## Suggesting Improvements

When proposing instruction updates, AI agents should:

1. **Identify the File**: Which instruction file needs updating?
2. **Explain the Gap**: What's missing or outdated?
3. **Provide Examples**: Show real code from the project
4. **Suggest Specific Changes**: Propose exact additions or modifications
5. **Note the Benefit**: How will this help future development?

### Template for Improvement Suggestions

```markdown
## Proposed Update to [filename].md

**Section**: [section name]

**Reason**: [Why this update is needed]

**Current Situation**:
[What's currently in the instructions or what's missing]

**Proposed Addition/Change**:
```
[Your proposed text with examples from actual code]
```

**Benefit**:
[How this improves the instructions]

**Related Files**:
[Any code files that exemplify this pattern]
```

## Instruction File Maintenance

### Architecture.md
- Update when major system components change
- Add new integration patterns
- Document architectural decisions as they're made

### Coding-standards.md
- Add patterns that appear in 3+ files
- Update when style conventions evolve
- Include real examples from the codebase

### Setup.md
- Update when dependencies change
- Add troubleshooting for new issues
- Document new environment variables or configs

### Security.md
- Add newly discovered vulnerability patterns
- Update when security libraries change
- Document security incidents and preventions

### Testing.md
- Add effective test patterns as discovered
- Update when testing frameworks change
- Document test coverage requirements

### Troubleshooting.md
- Add new issues as they're encountered
- Update solutions when better ones are found
- Cross-reference related instruction files

### Contributing.md
- Update when development workflow changes
- Add new quality checks as needed
- Update based on actual contribution experiences

## Deprecation Process

When patterns become outdated:

1. **Mark as Deprecated**: Add a deprecation notice
2. **Provide Migration Path**: Explain the new approach
3. **Update Examples**: Show before/after
4. **Set Timeline**: When the old pattern will be removed
5. **Remove Eventually**: Clean up after migration is complete

Example deprecation notice:

```markdown
## ⚠️ DEPRECATED: Old Pattern Name

**Status**: Deprecated as of [date]
**Reason**: [Why this is deprecated]
**Migration**: Use [new pattern] instead (see [section/file])
**Timeline**: This will be removed in [timeframe]

### Old Way (Don't use):
```python
# deprecated code
```

### New Way (Use this):
```python
# new recommended code
```
```

## Documentation Synchronization

Keep instructions synchronized with code:

- **Code Changes** → Update relevant instructions
- **New Features** → Add to architecture.md and setup.md
- **Bug Fixes** → Update troubleshooting.md if applicable
- **Library Updates** → Update setup.md and affected guides
- **Best Practice Changes** → Update coding-standards.md

## Self-Improvement Checklist

Before completing a task, AI agents should ask:

- [ ] Did I encounter any instruction gaps?
- [ ] Did I find better patterns than documented?
- [ ] Are there new patterns used 3+ times?
- [ ] Did I discover any preventable errors?
- [ ] Are the examples still current?
- [ ] Should any instructions be deprecated?
- [ ] Do instructions need better examples?
- [ ] Should I cross-reference other files?

## Meta-Improvement

This file itself should evolve:

- Add new improvement triggers as discovered
- Update the improvement process based on effectiveness
- Add examples of successful improvements
- Document what doesn't work
- Incorporate feedback from actual usage

---

*This guide should be updated whenever we discover better ways to maintain AI instructions.*
